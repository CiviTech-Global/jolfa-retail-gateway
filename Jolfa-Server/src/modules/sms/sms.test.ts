import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { createTestApp } from "../../../test/helpers/build-app.js";
import { createTestAdmin, createTestUser, getAuthToken } from "../../../test/helpers/factories.js";
import { prisma } from "../../shared/prisma.js";
import { normalizeMobile } from "../../shared/sms/smsir.client.js";
import { renderTemplate, unknownPlaceholders } from "../../shared/sms/sms-events.js";
import { ensureDefaultSmsTemplates, notify } from "../../shared/sms/notification.service.js";
import { queueNotification } from "../../shared/sms/notification-queue.js";

const API = "/api/v1/admin/sms";

/**
 * `env` is parsed from `process.env` once, when `config/env.ts` is first
 * imported, so `vi.stubEnv` cannot reach it — the SMS settings have to be
 * overridden on the validated object itself. The proxy lets each test write
 * into `smsEnv` and have the client see it, while everything else about `env`
 * stays real.
 */
const smsEnv = vi.hoisted(() => ({}) as Record<string, unknown>);

vi.mock("../../config/env.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../config/env.js")>();
  return {
    ...actual,
    env: new Proxy(actual.env as Record<string, unknown>, {
      get: (target, key) =>
        typeof key === "string" && key in smsEnv ? smsEnv[key] : target[key as string],
    }),
  };
});

/**
 * SMS.ir, stubbed at `fetch`.
 *
 * Stubbing the transport rather than the client keeps the part that actually
 * went wrong before — reading `status` out of the body rather than trusting
 * HTTP 200 — inside what is under test.
 */
function stubSmsIr(options: { status?: number; messageIds?: (number | null)[]; httpStatus?: number } = {}) {
  const calls: { url: string; body: Record<string, unknown> }[] = [];

  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: { body?: string }) => {
      const body = init.body ? (JSON.parse(init.body) as Record<string, unknown>) : {};
      calls.push({ url: String(url), body });

      return new Response(
        JSON.stringify({
          status: options.status ?? 1,
          message: "موفق",
          data: String(url).includes("/send/verify")
            ? { messageId: 555, cost: 1 }
            : { packId: "pack-1", messageIds: options.messageIds ?? [777], cost: 1 },
        }),
        {
          status: options.httpStatus ?? 200,
          headers: { "content-type": "application/json" },
        },
      );
    }),
  );

  return { calls };
}

afterEach(() => {
  vi.unstubAllGlobals();
  for (const key of Object.keys(smsEnv)) delete smsEnv[key];
});

describe("mobile normalisation", () => {
  // Numbers arrive from Persian keyboards, pasted contacts and imports, so all
  // of these forms occur in practice.
  it("accepts the forms Iranian numbers are actually written in", () => {
    for (const input of [
      "09121234567",
      "۰۹۱۲۱۲۳۴۵۶۷",
      "+989121234567",
      "00989121234567",
      "9121234567",
      "0912 123 4567",
      "0912-123-4567",
    ]) {
      expect(normalizeMobile(input)).toBe("09121234567");
    }
  });

  it("rejects anything that is not an Iranian mobile", () => {
    for (const input of ["02112345678", "0912123456", "091212345678", "hello", ""]) {
      expect(normalizeMobile(input)).toBeNull();
    }
  });
});

describe("template rendering", () => {
  it("substitutes the event's variables", () => {
    expect(renderTemplate("سفارش {{orderNumber}} ارسال شد", { orderNumber: "ORD-9" })).toBe(
      "سفارش ORD-9 ارسال شد",
    );
  });

  // Blanking it would read to the customer as a missing order number; left
  // as-is, the admin sees their own typo in the preview.
  it("leaves an unknown placeholder visible rather than blanking it", () => {
    expect(renderTemplate("سفارش {{ordrNumber}}", { orderNumber: "ORD-9" })).toBe(
      "سفارش {{ordrNumber}}",
    );
  });

  it("reports placeholders the event does not supply", () => {
    expect(unknownPlaceholders("{{orderNumber}} و {{nope}}", ["orderNumber"])).toEqual(["nope"]);
  });
});

describe("notify", () => {
  // No Fastify app here: `notify` is called directly, so building one would
  // only slow every case down.
  beforeEach(async () => {
    await ensureDefaultSmsTemplates();
  });

  it("sends an order update as free text from the shop's line", async () => {
    smsEnv.SMS_IR_API_KEY = "test-key";
    smsEnv.SMS_SENDER_NUMBER = "30004505000017";
    const { calls } = stubSmsIr();

    const result = await notify({
      event: "order_shipped",
      phone: "09121234567",
      variables: { orderNumber: "ORD-5", trackingNumber: "TRK-9", siteName: "ارس پرو" },
    });

    expect(result.outcome).toBe("sent");
    expect(calls[0].url).toContain("/send/bulk");
    expect(calls[0].body.messageText).toContain("ORD-5");
    expect(calls[0].body.messageText).toContain("TRK-9");
  });

  // One-time codes must go through the service line, or customers who have
  // blocked advertising SMS can never reset their password.
  it("sends a one-time code through the VERIFY template, not free text", async () => {
    smsEnv.SMS_IR_API_KEY = "test-key";
    smsEnv.SMS_IR_OTP_TEMPLATE_ID = 683431;
    await prisma.smsTemplate.update({
      where: { event: "password_reset_otp" },
      data: { providerTemplateId: 683431, enabled: true },
    });
    const { calls } = stubSmsIr();

    const result = await notify({
      event: "password_reset_otp",
      phone: "09121234567",
      variables: { code: "123456" },
    });

    expect(result.outcome).toBe("sent");
    expect(calls[0].url).toContain("/send/verify");
    expect(calls[0].body.templateId).toBe(683431);
    expect(calls[0].body.parameters).toEqual([{ name: "Code", value: "123456" }]);
  });

  // A reset code is a credential while it is valid. The log proves the message
  // was sent; it must not hand an admin — or a database backup — the code
  // itself, or anyone with panel access could take over any account.
  it("sends the real code but never writes it to the delivery log", async () => {
    smsEnv.SMS_IR_API_KEY = "test-key";
    smsEnv.SMS_IR_OTP_TEMPLATE_ID = 683431;
    await prisma.smsTemplate.update({
      where: { event: "password_reset_otp" },
      data: { providerTemplateId: 683431, enabled: true },
    });
    const { calls } = stubSmsIr();

    await notify({
      event: "password_reset_otp",
      phone: "09121234567",
      variables: { code: "424242" },
    });

    // The provider still gets the real value, or the SMS is useless.
    expect(calls[0].body.parameters).toEqual([{ name: "Code", value: "424242" }]);

    const logged = await prisma.smsNotification.findFirst({
      where: { template: "password_reset_otp" },
    });
    expect(logged?.message).not.toContain("424242");
    expect(logged?.message).toContain("******");
  });

  it("swallows a failure in work that nobody is awaiting", async () => {
    // Order and payment flows fire notifications without awaiting them, so a
    // rejection here would otherwise surface as an unhandled rejection and take
    // the process down after a purchase had already succeeded.
    await expect(
      queueNotification(Promise.reject(new Error("order vanished"))),
    ).resolves.toBeUndefined();
  });

  // The bug this rewrite exists for: SMS.ir answers HTTP 200 with the real
  // outcome in `status`, and the old code called any 200 a delivery.
  it("treats a logical failure returned with HTTP 200 as a failure", async () => {
    smsEnv.SMS_IR_API_KEY = "test-key";
    smsEnv.SMS_SENDER_NUMBER = "30004505000017";
    stubSmsIr({ status: 102 }); // insufficient credit

    const result = await notify({
      event: "order_shipped",
      phone: "09121234567",
      variables: { orderNumber: "ORD-5", trackingNumber: "T", siteName: "س" },
    });

    expect(result.outcome).toBe("failed");
    expect(result.reason).toContain("اعتبار");

    const row = await prisma.smsNotification.findFirstOrThrow({ where: { phone: "09121234567" } });
    expect(row.status).toBe("FAILED");
  });

  // A pack can succeed while an individual recipient is rejected: 0 means
  // blacklisted, null means invalid or over-length.
  it("treats a blacklisted recipient as a failure even though the pack succeeded", async () => {
    smsEnv.SMS_IR_API_KEY = "test-key";
    smsEnv.SMS_SENDER_NUMBER = "30004505000017";
    stubSmsIr({ messageIds: [0] });

    const result = await notify({
      event: "order_shipped",
      phone: "09121234567",
      variables: { orderNumber: "ORD-5", trackingNumber: "T", siteName: "س" },
    });

    expect(result.outcome).toBe("failed");
    expect(result.reason).toContain("لیست سیاه");
  });

  it("sends nothing for an event the admin switched off", async () => {
    smsEnv.SMS_IR_API_KEY = "test-key";
    smsEnv.SMS_SENDER_NUMBER = "30004505000017";
    await prisma.smsTemplate.update({
      where: { event: "order_shipped" },
      data: { enabled: false },
    });
    const { calls } = stubSmsIr();

    const result = await notify({
      event: "order_shipped",
      phone: "09121234567",
      variables: { orderNumber: "ORD-5", trackingNumber: "T", siteName: "س" },
    });

    expect(result.outcome).toBe("disabled");
    expect(calls).toHaveLength(0);
  });

  // Free text needs the shop's own line. Recorded rather than silently lost, so
  // the admin can see which notifications a missing setting cost them.
  it("records a free-text send that has no line number configured", async () => {
    smsEnv.SMS_IR_API_KEY = "test-key";
    smsEnv.SMS_SENDER_NUMBER = "";
    const { calls } = stubSmsIr();

    const result = await notify({
      event: "order_shipped",
      phone: "09121234567",
      variables: { orderNumber: "ORD-5", trackingNumber: "T", siteName: "س" },
    });

    expect(result.outcome).toBe("no_line");
    expect(calls).toHaveLength(0);
    const row = await prisma.smsNotification.findFirstOrThrow({ where: { phone: "09121234567" } });
    expect(row.status).toBe("FAILED");
  });

  it("rejects an unusable number before spending a request", async () => {
    smsEnv.SMS_IR_API_KEY = "test-key";
    smsEnv.SMS_SENDER_NUMBER = "30004505000017";
    const { calls } = stubSmsIr();

    const result = await notify({
      event: "order_shipped",
      phone: "02112345678",
      variables: { orderNumber: "ORD-5", trackingNumber: "T", siteName: "س" },
    });

    expect(result.outcome).toBe("invalid_number");
    expect(calls).toHaveLength(0);
  });

  it("logs instead of sending when no provider key is configured", async () => {
    smsEnv.SMS_IR_API_KEY = "";
    const { calls } = stubSmsIr();

    const result = await notify({
      event: "order_shipped",
      phone: "09121234567",
      variables: { orderNumber: "ORD-5", trackingNumber: "T", siteName: "س" },
    });

    expect(result.outcome).toBe("not_configured");
    expect(result.previewText).toContain("ORD-5");
    expect(calls).toHaveLength(0);
  });
});

describe("seeding", () => {
  it("creates a row per event in the catalogue", async () => {
    await ensureDefaultSmsTemplates();
    const rows = await prisma.smsTemplate.findMany();
    expect(rows.length).toBeGreaterThanOrEqual(8);
  });

  // A deploy must not re-enable an event the shop owner switched off, nor
  // overwrite wording they rewrote.
  it("never overwrites an edited template", async () => {
    await ensureDefaultSmsTemplates();
    await prisma.smsTemplate.update({
      where: { event: "order_shipped" },
      data: { enabled: false, body: "متن دلخواه مدیر" },
    });

    await ensureDefaultSmsTemplates();

    const row = await prisma.smsTemplate.findUniqueOrThrow({ where: { event: "order_shipped" } });
    expect(row.enabled).toBe(false);
    expect(row.body).toBe("متن دلخواه مدیر");
  });
});

describe("admin SMS endpoints", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await createTestApp();
    await ensureDefaultSmsTemplates();
  });

  const adminAuth = async () => {
    const { user } = await createTestAdmin();
    return { authorization: `Bearer ${getAuthToken(app, user)}` };
  };

  it("lists every event with its wording and preview", async () => {
    const res = await app.inject({
      method: "GET",
      url: `${API}/templates`,
      headers: await adminAuth(),
    });

    expect(res.statusCode).toBe(200);
    const templates = res.json().data.templates;
    const shipped = templates.find((t: { event: string }) => t.event === "order_shipped");
    expect(shipped.preview).toContain("ORD-1024");
    expect(shipped.variables).toContain("trackingNumber");
  });

  // An event marked "on" that cannot possibly deliver is worse than one marked
  // off, so the reason is surfaced per row.
  it("explains why a template cannot send", async () => {
    smsEnv.SMS_IR_API_KEY = "";

    const res = await app.inject({
      method: "GET",
      url: `${API}/templates`,
      headers: await adminAuth(),
    });

    const shipped = res
      .json()
      .data.templates.find((t: { event: string }) => t.event === "order_shipped");
    expect(shipped.blockedReason).toContain("SMS_IR_API_KEY");
  });

  it("saves new wording", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `${API}/templates/order_shipped`,
      headers: await adminAuth(),
      payload: { body: "سفارش {{orderNumber}} ارسال شد. رهگیری: {{trackingNumber}}" },
    });

    expect(res.statusCode).toBe(200);
    const row = await prisma.smsTemplate.findUniqueOrThrow({ where: { event: "order_shipped" } });
    expect(row.body).toContain("رهگیری");
  });

  it("refuses a placeholder the event does not supply", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `${API}/templates/order_shipped`,
      headers: await adminAuth(),
      payload: { body: "سفارش {{ordrNumber}}" },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error.message).toContain("ordrNumber");
  });

  // The OTP text lives on SMS.ir's panel, so pretending it is editable here
  // would let the admin "save" a change that never takes effect.
  it("refuses to edit the body of a VERIFY template", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `${API}/templates/password_reset_otp`,
      headers: await adminAuth(),
      payload: { body: "کد شما: {{code}}" },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe("SMS_BODY_NOT_EDITABLE");
  });

  it("switches an event off", async () => {
    await app.inject({
      method: "PATCH",
      url: `${API}/templates/welcome`,
      headers: await adminAuth(),
      payload: { enabled: false },
    });

    const row = await prisma.smsTemplate.findUniqueOrThrow({ where: { event: "welcome" } });
    expect(row.enabled).toBe(false);
  });

  it("refuses an unknown event", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `${API}/templates/not_an_event`,
      headers: await adminAuth(),
      payload: { enabled: false },
    });

    expect(res.statusCode).toBe(422);
  });

  it("refuses a customer", async () => {
    const { user } = await createTestUser();
    const res = await app.inject({
      method: "GET",
      url: `${API}/templates`,
      headers: { authorization: `Bearer ${getAuthToken(app, user)}` },
    });

    expect(res.statusCode).toBe(403);
  });

  it("sends a test message through the real path", async () => {
    smsEnv.SMS_IR_API_KEY = "test-key";
    smsEnv.SMS_SENDER_NUMBER = "30004505000017";
    const { calls } = stubSmsIr();

    const res = await app.inject({
      method: "POST",
      url: `${API}/test`,
      headers: await adminAuth(),
      payload: { event: "order_shipped", phone: "09121234567" },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().data.outcome).toBe("sent");
    // Sample values, so the admin sees real wording rather than empty gaps.
    expect(calls[0].body.messageText).toContain("ORD-1024");
  });

  it("requires a destination for a test send", async () => {
    const res = await app.inject({
      method: "POST",
      url: `${API}/test`,
      headers: await adminAuth(),
      payload: { event: "order_shipped" },
    });

    expect(res.statusCode).toBe(422);
  });

  it("reports account status without sending anything", async () => {
    smsEnv.SMS_IR_API_KEY = "test-key";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        new Response(
          JSON.stringify({
            status: 1,
            message: "موفق",
            data: String(url).includes("/credit") ? 165.3 : [30004505000017],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      ),
    );

    const res = await app.inject({
      method: "GET",
      url: `${API}/status`,
      headers: await adminAuth(),
    });

    expect(res.json().data.credit).toBe(165.3);
    expect(res.json().data.lines).toEqual([30004505000017]);
  });

  it("lists the delivery log newest first", async () => {
    smsEnv.SMS_IR_API_KEY = "";
    await notify({
      event: "order_shipped",
      phone: "09121234567",
      variables: { orderNumber: "ORD-1", trackingNumber: "T", siteName: "س" },
    });

    const res = await app.inject({
      method: "GET",
      url: `${API}/log`,
      headers: await adminAuth(),
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().data.rows[0].event).toBe("order_shipped");
  });
});
