import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { createTestApp } from "../../../test/helpers/build-app.js";
import { createTestAdmin, createTestUser, getAuthToken } from "../../../test/helpers/factories.js";
import { prisma } from "../../shared/prisma.js";
import { env } from "../../config/env.js";
import {
  PAYMENT_LIVE_MODE_KEY,
  ZIBAL_SANDBOX_MERCHANT,
  isLiveMode,
  isSandboxMode,
  setLiveMode,
} from "./payment-mode.service.js";

const API = "/api/v1/admin/payments/mode";

/**
 * `env` is parsed once from `process.env`, so the merchant id has to be set on
 * the validated object itself — the same reason the SMS tests proxy it.
 */
function setMerchant(value: string | undefined): void {
  (env as { ZIBAL_MERCHANT_ID?: string }).ZIBAL_MERCHANT_ID = value;
}

const originalMerchant = env.ZIBAL_MERCHANT_ID;

afterEach(() => {
  setMerchant(originalMerchant);
});

async function seedMode(value: "true" | "false"): Promise<void> {
  await prisma.setting.create({
    data: {
      key: PAYMENT_LIVE_MODE_KEY,
      value,
      group: "payments",
      isPublic: false,
      description: "test",
    },
  });
}

describe("payment mode", () => {
  it("is sandbox when nothing has been configured", async () => {
    setMerchant(undefined);
    expect(await isSandboxMode()).toBe(true);
    expect(await isLiveMode()).toBe(false);
  });

  // The row is what the payment path reads, so this is the assertion that
  // decides whether a customer's card is really charged.
  it("follows the stored row once it exists", async () => {
    setMerchant("real-merchant-id");
    await seedMode("true");
    expect(await isLiveMode()).toBe(true);

    await prisma.setting.update({
      where: { key: PAYMENT_LIVE_MODE_KEY },
      data: { value: "false" },
    });
    expect(await isLiveMode()).toBe(false);
  });

  it("refuses to go live without a merchant id", async () => {
    setMerchant(undefined);
    const { user: admin } = await createTestAdmin();

    await expect(setLiveMode(true, admin.id)).rejects.toThrow(/شناسه پذیرنده/);
    expect(await isLiveMode()).toBe(false);
  });

  // A merchant id of literally "zibal" IS the sandbox merchant, so accepting it
  // as a live one would report the shop live while no money moved.
  it("refuses to treat the sandbox merchant as a live one", async () => {
    setMerchant(ZIBAL_SANDBOX_MERCHANT);
    const { user: admin } = await createTestAdmin();

    await expect(setLiveMode(true, admin.id)).rejects.toThrow(/شناسه پذیرنده/);
  });

  it("can always be switched back to sandbox", async () => {
    setMerchant(undefined);
    const { user: admin } = await createTestAdmin();

    const status = await setLiveMode(false, admin.id);
    expect(status.live).toBe(false);
    expect(await isSandboxMode()).toBe(true);
  });

  it("records who switched it, and in which direction", async () => {
    setMerchant("real-merchant-id");
    const { user: admin } = await createTestAdmin();

    await setLiveMode(true, admin.id);

    const entry = await prisma.auditLog.findFirst({
      where: { userId: admin.id, entityType: "Setting" },
      orderBy: { createdAt: "desc" },
    });
    const metadata = (entry?.metadata ?? {}) as Record<string, unknown>;
    expect(metadata.setting).toBe(PAYMENT_LIVE_MODE_KEY);
    expect(metadata.before).toBe("sandbox");
    expect(metadata.after).toBe("live");
  });
});

describe("the admin endpoint", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await createTestApp();
  });

  it("reports the current mode and whether live is possible", async () => {
    setMerchant("real-merchant-id");
    const { user: admin } = await createTestAdmin();
    const token = getAuthToken(app, admin);

    const res = await app.inject({
      method: "GET",
      url: API,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().data.live).toBe(false);
    expect(res.json().data.canGoLive).toBe(true);
    // Enough to recognise, never the whole value.
    expect(res.json().data.merchantHint).not.toBe("real-merchant-id");
  });

  it("switches the shop to live", async () => {
    setMerchant("real-merchant-id");
    const { user: admin } = await createTestAdmin();
    const token = getAuthToken(app, admin);

    const res = await app.inject({
      method: "PATCH",
      url: API,
      headers: { authorization: `Bearer ${token}` },
      payload: { live: true },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().data.live).toBe(true);
    expect(await isLiveMode()).toBe(true);
  });

  it("refuses a customer", async () => {
    const { user } = await createTestUser();
    const token = getAuthToken(app, user);

    const res = await app.inject({
      method: "PATCH",
      url: API,
      headers: { authorization: `Bearer ${token}` },
      payload: { live: true },
    });

    expect(res.statusCode).toBe(403);
    expect(await isLiveMode()).toBe(false);
  });

  it("refuses an anonymous caller", async () => {
    const res = await app.inject({ method: "PATCH", url: API, payload: { live: true } });
    expect(res.statusCode).toBe(401);
  });

  // The generic settings screen renders every row it is given as a plain
  // field. Reachable there, one mis-click would start or stop real payments.
  it("is not reachable through the generic settings endpoint", async () => {
    setMerchant("real-merchant-id");
    await seedMode("false");
    const { user: admin } = await createTestAdmin();
    const token = getAuthToken(app, admin);

    const list = await app.inject({
      method: "GET",
      url: "/api/v1/settings",
      headers: { authorization: `Bearer ${token}` },
    });
    if (list.statusCode === 200) {
      const keys = (list.json().data.settings as { key: string }[]).map((s) => s.key);
      expect(keys).not.toContain(PAYMENT_LIVE_MODE_KEY);
    }

    const write = await app.inject({
      method: "PATCH",
      url: `/api/v1/settings/${PAYMENT_LIVE_MODE_KEY}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { value: "true" },
    });
    expect(write.statusCode).toBeGreaterThanOrEqual(400);
    expect(await isLiveMode()).toBe(false);
  });
});
