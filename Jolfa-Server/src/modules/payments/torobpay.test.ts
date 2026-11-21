import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import type { User } from "@prisma/client";
import { createTestApp } from "../../../test/helpers/build-app.js";
import {
  createTestAdmin,
  createTestProduct,
  createTestUser,
  getAuthToken,
  validShippingAddress,
} from "../../../test/helpers/factories.js";
import { prisma } from "../../shared/prisma.js";
import { env } from "../../config/env.js";
import { resetTorobPayTokenCache } from "./torobpay.client.js";
import { sweepPendingTorobPayPayments } from "./torobpay.service.js";
import { TOROBPAY_ENABLED_KEY } from "./torobpay-settings.service.js";

/**
 * TorobPay end to end: the real routes against the test database, with
 * TorobPay stubbed at `fetch` so the client's own logic — the envelope, error
 * codes, the token cache, the Rial conversion — stays inside what is tested.
 *
 * The cases follow the acceptance scenarios in the contract's annex 2.
 */

const PAYMENT_TOKEN = "tok-abc123";
const PAGE_URL = `https://cpg.torobpay.com/payment/brief-details?payment_token=${PAYMENT_TOKEN}`;

type Reply = { status?: number; body: unknown };

const ok = (response: unknown): Reply => ({ body: { successful: true, response } });
/**
 * A refusal in the shape the live service really sends (seen 21 Nov 2026):
 * `errorData`, with the code as a string. The PDF documents `error.code` as a
 * number instead; `failAsDocumented` covers that shape.
 */
const fail = (code: number, status = 400, user_message = ""): Reply => ({
  status,
  body: {
    successful: false,
    errorData: { errorCode: String(code), message: "err", data: {}, ...(user_message ? { user_message } : {}) },
  },
});
const failAsDocumented = (code: number, status = 400): Reply => ({
  status,
  body: { successful: false, error: { code, message: "err", data: null, user_message: "" } },
});

interface StubOptions {
  eligible?: boolean | "error";
  /** What /status reports. */
  status?: string;
  /** What /status reports as paid, in Rial. Defaults to what /token was asked for. */
  statusAmount?: number;
  verify?: Reply;
  revert?: Reply;
  cancel?: Reply;
  /** Answer the first authenticated call with 401, to exercise the token refresh. */
  expireFirstToken?: boolean;
  /** What the login endpoint answers instead of a token. */
  login?: Reply;
}

interface Call {
  path: string;
  method: string;
  headers: Record<string, string>;
  body: Record<string, unknown> | null;
  query: URLSearchParams;
}

let requestedAmount = 0;

function stubTorobPay(options: StubOptions = {}) {
  const calls: Call[] = [];
  let expired = !options.expireFirstToken;

  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string, init: RequestInit) => {
      const url = new URL(String(input));
      const body = init.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : null;
      const headers = init.headers as Record<string, string>;
      calls.push({ path: url.pathname, method: init.method ?? "GET", headers, body, query: url.searchParams });

      const respond = (reply: Reply) =>
        new Response(JSON.stringify(reply.body), {
          status: reply.status ?? 200,
          headers: { "content-type": "application/json" },
        });

      if (url.pathname === "/api/online/v1/oauth/token") {
        if (options.login) return respond(options.login);
        return respond({ body: { access_token: `jwt-${calls.length}` } });
      }
      if (!expired) {
        expired = true;
        return respond(fail(1000, 401));
      }

      switch (url.pathname) {
        case "/api/online/offer/v1/eligible":
          if (options.eligible === "error") return respond(fail(1011, 500));
          return respond(
            ok({
              eligible: options.eligible ?? true,
              title_message: "پرداخت اقساطی با ترب پی",
              description: "خرید در ۴ قسط",
            }),
          );
        case "/api/online/payment/v1/token":
          requestedAmount = Number(body?.amount);
          return respond(ok({ paymentToken: PAYMENT_TOKEN, paymentPageUrl: PAGE_URL }));
        case "/api/online/payment/v1/verify":
          return respond(options.verify ?? ok({ transactionId: "x" }));
        case "/api/online/payment/v1/status":
          return respond(
            ok({
              status: options.status ?? "VERIFY",
              amount: options.statusAmount ?? requestedAmount,
              transactionId: "x",
            }),
          );
        case "/api/online/payment/v1/settle":
          return respond(ok({ transactionId: "x" }));
        case "/api/online/payment/v1/revert":
          return respond(options.revert ?? ok({ transactionId: "x" }));
        case "/api/online/payment/v1/cancel":
          return respond(options.cancel ?? ok({ transactionId: "x" }));
        default:
          throw new Error(`unexpected call to ${url.pathname}`);
      }
    }),
  );

  const paths = () => calls.map((c) => c.path.replace("/api/online/", ""));
  return { calls, paths };
}

const credentialKeys = [
  "TOROBPAY_CLIENT_ID",
  "TOROBPAY_CLIENT_SECRET",
  "TOROBPAY_USERNAME",
  "TOROBPAY_PASSWORD",
] as const;

function setCredentials(configured: boolean) {
  const values = ["client-id-1234", "client-secret", "merchant-user", "merchant-pass"];
  credentialKeys.forEach((key, i) => {
    (env as Record<string, unknown>)[key] = configured ? values[i] : "";
  });
}

async function enableTorobPay(enabled = true) {
  await prisma.setting.upsert({
    where: { key: TOROBPAY_ENABLED_KEY },
    update: { value: String(enabled) },
    create: { key: TOROBPAY_ENABLED_KEY, value: String(enabled), group: "payments" },
  });
}

interface Fixture {
  app: FastifyInstance;
  user: User;
  token: string;
  orderId: string;
  finalAmount: number;
}

async function placeOrder(price = 500_000, quantity = 2): Promise<Fixture> {
  const app = await createTestApp();
  const { user } = await createTestUser({ phone: "09351234567" });
  const token = getAuthToken(app, user);
  const product = await createTestProduct({ title: "نوشابه لیمویی", price, stockQuantity: 10 });

  const res = await app.inject({
    method: "POST",
    url: "/api/v1/orders",
    headers: { authorization: `Bearer ${token}` },
    payload: {
      items: [{ productId: product.id, quantity }],
      shippingAddress: validShippingAddress({ district: "منطقه ۳" }),
      shippingMethod: "POST",
    },
  });
  expect(res.statusCode).toBe(201);
  const order = res.json().data.order;
  return { app, user, token, orderId: order.id, finalAmount: order.finalAmount };
}

function payWithTorobPay(f: Fixture) {
  return f.app.inject({
    method: "POST",
    url: "/api/v1/payments/request",
    headers: { authorization: `Bearer ${f.token}` },
    payload: { orderId: f.orderId, method: "TOROBPAY" },
  });
}

async function returnFromTorobPay(f: Fixture, state = "OK") {
  const payment = await prisma.payment.findUniqueOrThrow({ where: { orderId: f.orderId } });
  return f.app.inject({
    method: "POST",
    url: "/api/v1/payments/callback/torobpay",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    payload: `transactionId=${encodeURIComponent(payment.gatewayTransactionId!)}&state=${state}&amount=1`,
  });
}

function methodsFor(f: Fixture, amount: number) {
  return f.app.inject({
    method: "GET",
    url: `/api/v1/payments/methods?amount=${amount}`,
    headers: { authorization: `Bearer ${f.token}` },
  });
}

beforeEach(() => {
  resetTorobPayTokenCache();
  setCredentials(true);
});

afterEach(() => {
  vi.unstubAllGlobals();
  setCredentials(false);
  requestedAmount = 0;
});

describe("offering TorobPay at checkout (scenarios 1, 2, 8)", () => {
  it("offers TorobPay with TorobPay's own wording when it says the cart is eligible", async () => {
    const stub = stubTorobPay();
    await enableTorobPay();
    const f = await placeOrder();

    const res = await methodsFor(f, 1_000_000);

    expect(res.statusCode).toBe(200);
    const methods = res.json().data.methods;
    expect(methods.map((m: { id: string }) => m.id)).toEqual(["ZIBAL", "TOROBPAY"]);
    expect(methods[1].title).toBe("پرداخت اقساطی با ترب پی");
    // Asked in Rial.
    const eligible = stub.calls.find((c) => c.path.endsWith("/eligible"))!;
    expect(eligible.query.get("amount")).toBe("10000000");
    expect(eligible.headers.authorization).toMatch(/^Bearer jwt-/);
  });

  it("does not ask TorobPay about a cart under 20,000 Toman", async () => {
    const stub = stubTorobPay();
    await enableTorobPay();
    const f = await placeOrder();

    const res = await methodsFor(f, 19_999);

    expect(res.json().data.methods.map((m: { id: string }) => m.id)).toEqual(["ZIBAL"]);
    expect(stub.calls).toHaveLength(0);
  });

  it("hides TorobPay when TorobPay says the cart is not eligible", async () => {
    stubTorobPay({ eligible: false });
    await enableTorobPay();
    const f = await placeOrder();

    const res = await methodsFor(f, 1_000_000);
    expect(res.json().data.methods.map((m: { id: string }) => m.id)).toEqual(["ZIBAL"]);
  });

  it("hides TorobPay, not the checkout, when TorobPay is failing", async () => {
    stubTorobPay({ eligible: "error" });
    await enableTorobPay();
    const f = await placeOrder();

    const res = await methodsFor(f, 1_000_000);
    expect(res.statusCode).toBe(200);
    expect(res.json().data.methods.map((m: { id: string }) => m.id)).toEqual(["ZIBAL"]);
  });

  it("hides TorobPay when the shop has switched it off", async () => {
    const stub = stubTorobPay();
    await enableTorobPay(false);
    const f = await placeOrder();

    const res = await methodsFor(f, 1_000_000);
    expect(res.json().data.methods.map((m: { id: string }) => m.id)).toEqual(["ZIBAL"]);
    expect(stub.calls).toHaveLength(0);
  });

  it("refuses a TorobPay payment while switched off, whatever the browser sends", async () => {
    stubTorobPay();
    await enableTorobPay(false);
    const f = await placeOrder();

    const res = await payWithTorobPay(f);
    expect(res.statusCode).toBe(400);
  });
});

describe("opening a TorobPay payment", () => {
  it("sends the order to TorobPay in Rial and returns its payment page", async () => {
    const stub = stubTorobPay();
    await enableTorobPay();
    const f = await placeOrder(500_000, 2);

    const res = await payWithTorobPay(f);

    expect(res.statusCode).toBe(200);
    expect(res.json().data.paymentUrl).toBe(PAGE_URL);

    const call = stub.calls.find((c) => c.path.endsWith("/payment/v1/token"))!;
    const body = call.body!;
    expect(body.amount).toBe(f.finalAmount * 10);
    expect(body.paymentMethodTypeDto).toBe("ONLINE_CREDIT");
    expect(body.returnURL).toBe(`${env.APP_URL}/api/v1/payments/callback/torobpay`);
    expect(body.postalCode).toBe("1234567890");
    expect(body.customer_full_name).toBe("علی رضایی");
    expect(body.address).toBe("منطقه ۳، خیابان ولیعصر، پلاک ۱");
    expect(body.registration_phone_number).toBe("09351234567");

    const cart = (body.cartList as Record<string, unknown>[])[0];
    expect(cart.totalAmount).toBe(f.finalAmount * 10);
    const item = (cart.cartItems as Record<string, unknown>[])[0];
    expect(item).toMatchObject({ name: "نوشابه لیمویی", count: 2, amount: 5_000_000, commissionType: 0 });
    expect(typeof item.category).toBe("string");

    const payment = await prisma.payment.findUniqueOrThrow({ where: { orderId: f.orderId } });
    expect(payment).toMatchObject({ gateway: "TOROBPAY", status: "PENDING", authority: PAYMENT_TOKEN });
    expect(payment.gatewayTransactionId).toBe(body.transactionId);
  });

  it("logs in with Basic client credentials once and reuses the token", async () => {
    const stub = stubTorobPay();
    await enableTorobPay();
    const f = await placeOrder();

    await methodsFor(f, 1_000_000);
    await methodsFor(f, 1_000_000);

    const logins = stub.calls.filter((c) => c.path.endsWith("/oauth/token"));
    expect(logins).toHaveLength(1);
    const expected = Buffer.from("client-id-1234:client-secret").toString("base64");
    expect(logins[0].headers.authorization).toBe(`Basic ${expected}`);
    expect(logins[0].body).toEqual({ username: "merchant-user", password: "merchant-pass" });
  });

  it("renews an access token TorobPay no longer accepts", async () => {
    const stub = stubTorobPay({ expireFirstToken: true });
    await enableTorobPay();
    const f = await placeOrder();

    const res = await methodsFor(f, 1_000_000);

    expect(res.json().data.methods).toHaveLength(2);
    expect(stub.calls.filter((c) => c.path.endsWith("/oauth/token"))).toHaveLength(2);
  });

  it("reuses the open session when the customer presses pay again", async () => {
    const stub = stubTorobPay();
    await enableTorobPay();
    const f = await placeOrder();

    await payWithTorobPay(f);
    const again = await payWithTorobPay(f);

    expect(again.json().data.paymentUrl).toBe(PAGE_URL);
    expect(stub.calls.filter((c) => c.path.endsWith("/payment/v1/token"))).toHaveLength(1);
  });
});

describe("the customer's return (scenarios 3–6)", () => {
  it("verifies, checks the amount, settles, and marks the order paid", async () => {
    const stub = stubTorobPay({ status: "VERIFY" });
    await enableTorobPay();
    const f = await placeOrder();
    await payWithTorobPay(f);

    const res = await returnFromTorobPay(f);

    expect(res.statusCode).toBe(303);
    const location = new URL(res.headers.location as string);
    expect(location.pathname).toBe("/payment/callback");
    expect(location.searchParams.get("status")).toBe("OK");
    expect(location.searchParams.get("refId")).toMatch(/^JLF-/);

    expect(stub.paths()).toEqual(
      expect.arrayContaining(["payment/v1/verify", "payment/v1/status", "payment/v1/settle"]),
    );

    const order = await prisma.order.findUniqueOrThrow({ where: { id: f.orderId }, include: { payment: true } });
    expect(order.status).toBe("PROCESSING");
    expect(order.paymentStatus).toBe("COMPLETED");
    expect(order.payment?.status).toBe("COMPLETED");
    expect(order.payment?.paidAt).not.toBeNull();
  });

  it("ignores a forged 'OK' when TorobPay says the order failed", async () => {
    stubTorobPay({ status: "REVERT", verify: fail(1053) });
    await enableTorobPay();
    const f = await placeOrder();
    await payWithTorobPay(f);

    const res = await returnFromTorobPay(f, "OK");

    expect(new URL(res.headers.location as string).searchParams.get("status")).toBe("NOK");
    const order = await prisma.order.findUniqueOrThrow({ where: { id: f.orderId }, include: { payment: true } });
    expect(order.paymentStatus).toBe("PENDING");
    expect(order.payment?.status).toBe("FAILED");
  });

  it("lets the customer pay again after a failed attempt, under a new transaction id", async () => {
    const stub = stubTorobPay({ status: "REVERT", verify: fail(1053) });
    await enableTorobPay();
    const f = await placeOrder();
    await payWithTorobPay(f);
    const first = await prisma.payment.findUniqueOrThrow({ where: { orderId: f.orderId } });
    await returnFromTorobPay(f, "FAILED");

    const retry = await payWithTorobPay(f);

    expect(retry.statusCode).toBe(200);
    const second = await prisma.payment.findUniqueOrThrow({ where: { orderId: f.orderId } });
    expect(second.status).toBe("PENDING");
    expect(second.gatewayTransactionId).not.toBe(first.gatewayTransactionId);
    expect(stub.calls.filter((c) => c.path.endsWith("/payment/v1/token"))).toHaveLength(2);
  });

  it("keeps the order payable when TorobPay has not decided yet", async () => {
    stubTorobPay({ status: "PENDING", verify: fail(1053) });
    await enableTorobPay();
    const f = await placeOrder();
    await payWithTorobPay(f);

    const res = await returnFromTorobPay(f);

    expect(new URL(res.headers.location as string).searchParams.get("status")).toBe("PENDING");
    const payment = await prisma.payment.findUniqueOrThrow({ where: { orderId: f.orderId } });
    expect(payment.status).toBe("PENDING");
  });

  it("reverts and refuses an order paid for the wrong amount", async () => {
    const stub = stubTorobPay({ status: "VERIFY", statusAmount: 10 });
    await enableTorobPay();
    const f = await placeOrder();
    await payWithTorobPay(f);

    const res = await returnFromTorobPay(f);

    expect(new URL(res.headers.location as string).searchParams.get("status")).toBe("NOK");
    expect(stub.paths()).toContain("payment/v1/revert");
    expect(stub.paths()).not.toContain("payment/v1/settle");
    const order = await prisma.order.findUniqueOrThrow({ where: { id: f.orderId }, include: { payment: true } });
    expect(order.paymentStatus).toBe("PENDING");
    expect(order.payment?.status).toBe("FAILED");
  });

  it("records a payment once however many times the customer comes back", async () => {
    stubTorobPay({ status: "VERIFY" });
    await enableTorobPay();
    const f = await placeOrder();
    await payWithTorobPay(f);

    await Promise.all([returnFromTorobPay(f), returnFromTorobPay(f)]);
    // The result page's fallback check, after the fact.
    const payment = await prisma.payment.findUniqueOrThrow({ where: { orderId: f.orderId } });
    const fallback = await f.app.inject({
      method: "POST",
      url: "/api/v1/payments/verify",
      payload: { authority: payment.authority },
    });

    expect(fallback.json().data.success).toBe(true);
    const completed = await prisma.transaction.count({
      where: { orderId: f.orderId, type: "PAYMENT", status: "COMPLETED" },
    });
    expect(completed).toBe(1);
  });

  it("sends an unknown return to the result page instead of an error", async () => {
    stubTorobPay();
    const f = await placeOrder();

    const res = await f.app.inject({
      method: "POST",
      url: "/api/v1/payments/callback/torobpay",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      payload: "transactionId=never-issued&state=OK&amount=1",
    });

    expect(res.statusCode).toBe(303);
    expect(new URL(res.headers.location as string).searchParams.get("status")).toBe("NOK");
  });

  it("settles a customer who paid but never came back", async () => {
    stubTorobPay({ status: "SETTLE", verify: fail(1053) });
    await enableTorobPay();
    const f = await placeOrder();
    await payWithTorobPay(f);
    // Old enough for the sweep to consider it abandoned by the browser.
    await prisma.$executeRaw`UPDATE payments SET updated_at = now() - interval '5 minutes' WHERE order_id = ${f.orderId}::uuid`;

    const settled = await sweepPendingTorobPayPayments();

    expect(settled).toBe(1);
    const order = await prisma.order.findUniqueOrThrow({ where: { id: f.orderId } });
    expect(order.paymentStatus).toBe("COMPLETED");
  });
});

async function paidOrder(stubOptions: StubOptions = {}) {
  const stub = stubTorobPay({ status: "VERIFY", ...stubOptions });
  await enableTorobPay();
  const f = await placeOrder();
  await payWithTorobPay(f);
  await returnFromTorobPay(f);
  const { user: admin } = await createTestAdmin();
  return { stub, f, adminToken: getAuthToken(f.app, admin) };
}

function cancelAsAdmin(f: Fixture, adminToken: string) {
  return f.app.inject({
    method: "POST",
    url: `/api/v1/admin/orders/${f.orderId}/cancel`,
    headers: { authorization: `Bearer ${adminToken}` },
    payload: { reason: "ناموجود" },
  });
}

describe("cancelling a TorobPay order (scenario 7)", () => {
  it("reverts at TorobPay within 30 minutes of payment, then cancels locally", async () => {
    const { stub, f, adminToken } = await paidOrder();

    const res = await cancelAsAdmin(f, adminToken);

    expect(res.statusCode).toBe(200);
    expect(stub.paths()).toContain("payment/v1/revert");
    expect(stub.paths()).not.toContain("payment/v1/cancel");
    const refund = await prisma.transaction.findFirstOrThrow({ where: { orderId: f.orderId, type: "REFUND" } });
    expect(refund.metadata).toMatchObject({ torobPayRefund: "REVERT" });
    const order = await prisma.order.findUniqueOrThrow({ where: { id: f.orderId } });
    expect(order.status).toBe("CANCELLED");
    const refunded = await prisma.payment.findUniqueOrThrow({ where: { orderId: f.orderId } });
    expect(refunded.status).toBe("REFUNDED");
  });

  it("cancels at TorobPay (Paya refund) after the revert window", async () => {
    const { stub, f, adminToken } = await paidOrder();
    await prisma.payment.update({
      where: { orderId: f.orderId },
      data: { paidAt: new Date(Date.now() - 31 * 60 * 1000) },
    });

    await cancelAsAdmin(f, adminToken);

    expect(stub.paths()).toContain("payment/v1/cancel");
    const refund = await prisma.transaction.findFirstOrThrow({ where: { orderId: f.orderId, type: "REFUND" } });
    expect(refund.metadata).toMatchObject({ torobPayRefund: "CANCEL" });
  });

  it("falls back to cancel when TorobPay says it is too late to revert", async () => {
    const { stub, f, adminToken } = await paidOrder({ revert: fail(1065) });

    const res = await cancelAsAdmin(f, adminToken);

    expect(res.statusCode).toBe(200);
    expect(stub.paths()).toContain("payment/v1/cancel");
  });

  it("leaves the order untouched when TorobPay refuses the cancellation", async () => {
    const { f, adminToken } = await paidOrder({
      revert: fail(1099, 403, "مرچنت غیرفعال است"),
    });

    const res = await cancelAsAdmin(f, adminToken);

    expect(res.statusCode).toBe(502);
    expect(res.json().message ?? res.json().error?.message).toContain("مرچنت غیرفعال است");
    const order = await prisma.order.findUniqueOrThrow({ where: { id: f.orderId } });
    expect(order.status).toBe("PROCESSING");
    expect(order.paymentStatus).toBe("COMPLETED");
  });

  it("returns the money, rather than reviving the order, when it was cancelled mid-payment", async () => {
    const stub = stubTorobPay({ status: "VERIFY" });
    await enableTorobPay();
    const f = await placeOrder();
    await payWithTorobPay(f);
    const { user: admin } = await createTestAdmin();

    // Cancelled while the customer is still on TorobPay's page: nothing paid
    // yet, so nothing to undo at TorobPay.
    const cancel = await cancelAsAdmin(f, getAuthToken(f.app, admin));
    expect(cancel.statusCode).toBe(200);
    expect(stub.paths()).not.toContain("payment/v1/revert");

    // Then the customer finishes paying and comes back.
    const res = await returnFromTorobPay(f);

    expect(new URL(res.headers.location as string).searchParams.get("status")).toBe("NOK");
    expect(stub.paths()).toContain("payment/v1/revert");
    expect(stub.paths()).not.toContain("payment/v1/settle");
    const order = await prisma.order.findUniqueOrThrow({ where: { id: f.orderId }, include: { payment: true } });
    expect(order.status).toBe("CANCELLED");
    expect(order.payment?.status).toBe("FAILED");
  });

  it("refuses a partial refund, which TorobPay cannot carry out", async () => {
    const { f, adminToken } = await paidOrder();

    const res = await f.app.inject({
      method: "POST",
      url: `/api/v1/admin/orders/${f.orderId}/refund`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { amount: 1000 },
    });

    expect(res.statusCode).toBe(400);
  });
});

describe("admin controls (scenarios 8, 9)", () => {
  it("will not switch TorobPay on without credentials", async () => {
    setCredentials(false);
    const app = await createTestApp();
    const { user: admin } = await createTestAdmin();

    const res = await app.inject({
      method: "PATCH",
      url: "/api/v1/admin/payments/torobpay",
      headers: { authorization: `Bearer ${getAuthToken(app, admin)}` },
      payload: { enabled: true },
    });

    expect(res.statusCode).toBe(400);
  });

  it("switches TorobPay on and records who did it", async () => {
    const app = await createTestApp();
    const { user: admin } = await createTestAdmin();

    const res = await app.inject({
      method: "PATCH",
      url: "/api/v1/admin/payments/torobpay",
      headers: { authorization: `Bearer ${getAuthToken(app, admin)}` },
      payload: { enabled: true },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().data).toMatchObject({ enabled: true, configured: true });
    // The full client id never leaves the server.
    expect(JSON.stringify(res.json().data)).not.toContain("client-id-1234");
    const audit = await prisma.auditLog.findFirst({ where: { userId: admin.id, entityType: "Setting" } });
    expect(audit?.metadata).toMatchObject({ setting: TOROBPAY_ENABLED_KEY, after: "on" });
  });

  it("keeps the switch away from customers", async () => {
    const f = await placeOrder();
    const res = await f.app.inject({
      method: "PATCH",
      url: "/api/v1/admin/payments/torobpay",
      headers: { authorization: `Bearer ${f.token}` },
      payload: { enabled: true },
    });
    expect(res.statusCode).toBe(403);
  });

  it("checks a payment at TorobPay and settles it if it was still pending", async () => {
    stubTorobPay({ status: "SETTLE", verify: fail(1053) });
    await enableTorobPay();
    const f = await placeOrder();
    await payWithTorobPay(f);
    const payment = await prisma.payment.findUniqueOrThrow({ where: { orderId: f.orderId } });
    const { user: admin } = await createTestAdmin();

    const res = await f.app.inject({
      method: "POST",
      url: `/api/v1/admin/payments/${payment.id}/torobpay-status`,
      headers: { authorization: `Bearer ${getAuthToken(f.app, admin)}` },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().data).toMatchObject({ status: "SETTLE", localStatus: "COMPLETED" });
  });
});

describe("reading TorobPay's refusals", () => {
  it("still falls back to cancel when the too-late code comes in the documented shape", async () => {
    const { stub, f, adminToken } = await paidOrder({ revert: failAsDocumented(1065) });

    const res = await cancelAsAdmin(f, adminToken);

    expect(res.statusCode).toBe(200);
    expect(stub.paths()).toContain("payment/v1/cancel");
  });

  it("tells the owner when the username or password is wrong", async () => {
    stubTorobPay({ login: fail(1024, 403) });
    const app = await createTestApp();
    const { user: admin } = await createTestAdmin();
    const f = await placeOrder();
    await prisma.payment.create({
      data: { orderId: f.orderId, gateway: "TOROBPAY", amount: 1, authority: "tok-x", status: "COMPLETED" },
    });
    const payment = await prisma.payment.findUniqueOrThrow({ where: { orderId: f.orderId } });

    const res = await app.inject({
      method: "POST",
      url: `/api/v1/admin/payments/${payment.id}/torobpay-status`,
      headers: { authorization: `Bearer ${getAuthToken(app, admin)}` },
    });

    expect(res.statusCode).toBe(502);
    expect(JSON.stringify(res.json())).toContain("نام کاربری یا رمز عبور ترب‌پی نادرست است");
  });
});

describe("Zibal alongside TorobPay (scenario 10)", () => {
  it("sends a customer who tried TorobPay and then chose a card to Zibal", async () => {
    // The card gateway is Zibal only when a Zibal merchant is configured; CI
    // has none, so this case sets one up rather than relying on the machine.
    const previousMerchant = env.ZIBAL_MERCHANT_ID;
    (env as Record<string, unknown>).ZIBAL_MERCHANT_ID = "test-zibal-merchant";
    onTestFinished(() => {
      (env as Record<string, unknown>).ZIBAL_MERCHANT_ID = previousMerchant;
    });
    stubTorobPay();
    await enableTorobPay();
    const f = await placeOrder();
    await payWithTorobPay(f);

    // Now a Zibal stub: the customer changed their mind.
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ result: 100, trackId: 123456789, message: "success" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      ),
    );
    const res = await f.app.inject({
      method: "POST",
      url: "/api/v1/payments/request",
      headers: { authorization: `Bearer ${f.token}` },
      payload: { orderId: f.orderId },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().data.paymentUrl).toContain("gateway.zibal.ir/start/123456789");
    const payment = await prisma.payment.findUniqueOrThrow({ where: { orderId: f.orderId } });
    expect(payment.gateway).toBe("ZIBAL");
    // The TorobPay attempt's id must no longer find this payment.
    expect(payment.gatewayTransactionId).toBeNull();
  });
});
