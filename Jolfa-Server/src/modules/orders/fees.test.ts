import { describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { createTestApp } from "../../../test/helpers/build-app.js";
import {
  createTestAdmin,
  createTestProduct,
  createTestUser,
  getAuthToken,
  validShippingAddress,
} from "../../../test/helpers/factories.js";
import { ensureDefaultSettings } from "../settings/settings.service.js";
import { prisma } from "../../shared/prisma.js";
import { SHIPPING_COST_DEFAULTS } from "./shipping.service.js";
import { ORDER_FEES, getOrderFeesConfig, orderFeesFor } from "./fees.service.js";

async function setSetting(key: string, value: string): Promise<void> {
  await prisma.setting.upsert({
    where: { key },
    update: { value },
    create: { key, value, group: "fees", isPublic: true, description: "test" },
  });
}

async function placeOrder(app: FastifyInstance, price = 100_000) {
  const { user } = await createTestUser();
  const product = await createTestProduct({ price, stockQuantity: 5 });
  const res = await app.inject({
    method: "POST",
    url: "/api/v1/orders",
    headers: { authorization: `Bearer ${getAuthToken(app, user)}` },
    payload: {
      items: [{ productId: product.id, quantity: 1 }],
      shippingAddress: validShippingAddress(),
      shippingMethod: "POST",
    },
  });
  expect(res.statusCode).toBe(201);
  return res.json().data.order;
}

describe("order fee settings", () => {
  it("charges nothing when the settings are absent", async () => {
    const config = await getOrderFeesConfig();
    expect(config.packaging.enabled).toBe(false);
    expect(config.collectFreight.enabled).toBe(false);
    expect(orderFeesFor(config)).toEqual({
      packagingFee: 0,
      packagingFeeLabel: null,
      collectFreightFee: 0,
      collectFreightFeeLabel: null,
    });
  });

  it("seeds both fees switched off, with their default names", async () => {
    await ensureDefaultSettings();
    const config = await getOrderFeesConfig();
    expect(config.packaging).toEqual({ enabled: false, label: "هزینه بسته‌بندی", amount: 0 });
    expect(config.collectFreight).toEqual({ enabled: false, label: "هزینه پس‌کرایه", amount: 0 });
  });

  it("leaves no trace for a fee that is on but zero", async () => {
    await setSetting(ORDER_FEES.packaging.keys.enabled, "true");
    await setSetting(ORDER_FEES.packaging.keys.amount, "0");
    expect(orderFeesFor(await getOrderFeesConfig()).packagingFeeLabel).toBeNull();
  });
});

describe("placing an order with fees", () => {
  it("adds each enabled fee to the total and keeps its name on the order", async () => {
    const app = await createTestApp();
    await setSetting(ORDER_FEES.packaging.keys.enabled, "true");
    await setSetting(ORDER_FEES.packaging.keys.label, "بسته‌بندی کادویی");
    await setSetting(ORDER_FEES.packaging.keys.amount, "20000");
    await setSetting(ORDER_FEES.collectFreight.keys.enabled, "true");
    await setSetting(ORDER_FEES.collectFreight.keys.amount, "35000");

    const order = await placeOrder(app, 100_000);

    expect(order.packagingFee).toBe(20_000);
    expect(order.packagingFeeLabel).toBe("بسته‌بندی کادویی");
    expect(order.collectFreightFee).toBe(35_000);
    expect(order.collectFreightFeeLabel).toBe("هزینه پس‌کرایه");
    expect(order.finalAmount).toBe(100_000 + SHIPPING_COST_DEFAULTS.POST + 20_000 + 35_000);
    await app.close();
  });

  it("does not tax the fees", async () => {
    const app = await createTestApp();
    await setSetting("vat_enabled", "true");
    await setSetting("vat_percent", "10");
    await setSetting(ORDER_FEES.packaging.keys.enabled, "true");
    await setSetting(ORDER_FEES.packaging.keys.amount, "50000");

    const order = await placeOrder(app, 100_000);

    expect(order.taxAmount).toBe(10_000);
    expect(order.finalAmount).toBe(100_000 + SHIPPING_COST_DEFAULTS.POST + 50_000 + 10_000);
    await app.close();
  });

  it("ignores a disabled fee and keeps placed orders as charged when settings change", async () => {
    const app = await createTestApp();
    await setSetting(ORDER_FEES.packaging.keys.enabled, "true");
    await setSetting(ORDER_FEES.packaging.keys.amount, "20000");
    const first = await placeOrder(app);

    await setSetting(ORDER_FEES.packaging.keys.enabled, "false");
    const second = await placeOrder(app);

    expect(second.packagingFee).toBe(0);
    expect(second.packagingFeeLabel).toBeNull();
    const stored = await prisma.order.findUniqueOrThrow({ where: { id: first.id } });
    expect(stored.packagingFee).toBe(20_000);
    await app.close();
  });
});

describe("editing fees in the admin panel", () => {
  async function patch(app: FastifyInstance, key: string, value: string) {
    const { user: admin } = await createTestAdmin();
    return app.inject({
      method: "PATCH",
      url: `/api/v1/settings/${key}`,
      headers: { authorization: `Bearer ${getAuthToken(app, admin)}` },
      payload: { value },
    });
  }

  it("stores a Persian-digit amount in plain form", async () => {
    const app = await createTestApp();
    await ensureDefaultSettings();
    const res = await patch(app, ORDER_FEES.packaging.keys.amount, "۲۰٬۰۰۰");
    expect(res.statusCode).toBe(200);
    const row = await prisma.setting.findUniqueOrThrow({
      where: { key: ORDER_FEES.packaging.keys.amount },
    });
    expect(row.value).toBe("20000");
    await app.close();
  });

  it("refuses an amount that is not a whole Toman figure", async () => {
    const app = await createTestApp();
    await ensureDefaultSettings();
    for (const bad of ["abc", "-5", "12.5"]) {
      const res = await patch(app, ORDER_FEES.collectFreight.keys.amount, bad);
      expect(res.statusCode).toBe(400);
    }
    await app.close();
  });

  it("brings the default name back when the label is cleared", async () => {
    const app = await createTestApp();
    await ensureDefaultSettings();
    const res = await patch(app, ORDER_FEES.collectFreight.keys.label, "   ");
    expect(res.statusCode).toBe(200);
    expect((await getOrderFeesConfig()).collectFreight.label).toBe("هزینه پس‌کرایه");
    await app.close();
  });
});
