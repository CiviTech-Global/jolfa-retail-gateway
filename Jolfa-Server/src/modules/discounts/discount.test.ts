import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { createTestApp } from "../../../test/helpers/build-app.js";
import {
  createTestAdmin,
  createTestProduct,
  createTestUser,
  getAuthToken,
  validShippingAddress,
} from "../../../test/helpers/factories.js";
import { prisma } from "../../shared/prisma.js";
import { calculateDiscount } from "./discount.service.js";
import { normalizeDiscountCode } from "./discount.types.js";

let app: FastifyInstance;
let adminToken: string;

beforeEach(async () => {
  app = await createTestApp();
  const { user: admin } = await createTestAdmin();
  adminToken = getAuthToken(app, admin);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function defineCode(body: Record<string, unknown>) {
  const res = await app.inject({
    method: "POST",
    url: "/api/v1/admin/discount-codes",
    headers: { authorization: `Bearer ${adminToken}` },
    payload: { type: "PERCENT", value: 10, ...body },
  });
  return res;
}

async function customer() {
  const { user } = await createTestUser();
  return { user, token: getAuthToken(app, user) };
}

async function placeOrder(token: string, discountCode?: string, price = 100_000, quantity = 2) {
  const product = await createTestProduct({ price, stockQuantity: 50 });
  return app.inject({
    method: "POST",
    url: "/api/v1/orders",
    headers: { authorization: `Bearer ${token}` },
    payload: {
      items: [{ productId: product.id, quantity }],
      shippingAddress: validShippingAddress(),
      shippingMethod: "POST",
      ...(discountCode === undefined ? {} : { discountCode }),
    },
  });
}

async function markPaid(orderId: string) {
  await prisma.order.update({ where: { id: orderId }, data: { paymentStatus: "COMPLETED", status: "PROCESSING" } });
}

describe("the arithmetic", () => {
  it("takes a percentage of the subtotal, rounded down, within the cap", () => {
    expect(calculateDiscount({ type: "PERCENT", value: 15, maxDiscountAmount: null }, 99_999)).toBe(14_999);
    expect(calculateDiscount({ type: "PERCENT", value: 50, maxDiscountAmount: 30_000 }, 200_000)).toBe(30_000);
  });

  it("never takes more than the items cost", () => {
    expect(calculateDiscount({ type: "FIXED", value: 500_000, maxDiscountAmount: null }, 120_000)).toBe(120_000);
    expect(calculateDiscount({ type: "PERCENT", value: 100, maxDiscountAmount: null }, 80_000)).toBe(80_000);
  });

  it("treats a code typed in Persian digits, spaces or lower case as the same code", () => {
    expect(normalizeDiscountCode(" yalda-۱۴۰۵ ")).toBe("YALDA-1405");
  });
});

describe("defining codes (admin)", () => {
  it("stores the code normalised and records who created it", async () => {
    const res = await defineCode({ code: "yalda ۱۴۰۵", type: "FIXED", value: 50_000 });

    expect(res.statusCode).toBe(201);
    expect(res.json().data.discountCode.code).toBe("YALDA1405");
    const audit = await prisma.auditLog.findFirst({ where: { entityType: "DiscountCode", action: "CREATE" } });
    expect(audit).not.toBeNull();
  });

  it("refuses a percentage over 100, an end before the start, and a duplicate", async () => {
    expect((await defineCode({ code: "TOO-MUCH", value: 120 })).statusCode).toBe(422);
    expect(
      (await defineCode({ code: "BACKWARDS", startsAt: "2026-12-01", expiresAt: "2026-11-01" })).statusCode,
    ).toBe(422);
    await defineCode({ code: "TWICE" });
    expect((await defineCode({ code: "twice" })).statusCode).toBe(409);
  });

  it("keeps code management away from customers", async () => {
    const { token } = await customer();
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/admin/discount-codes",
      headers: { authorization: `Bearer ${token}` },
      payload: { code: "MINE", type: "FIXED", value: 1000 },
    });
    expect(res.statusCode).toBe(403);
  });

  it("will not delete a code that orders used, but deletes an unused one", async () => {
    const used = (await defineCode({ code: "USED-ONE" })).json().data.discountCode;
    const unused = (await defineCode({ code: "UNUSED-ONE" })).json().data.discountCode;
    const { token } = await customer();
    expect((await placeOrder(token, "USED-ONE")).statusCode).toBe(201);

    const del = (id: string) =>
      app.inject({
        method: "DELETE",
        url: `/api/v1/admin/discount-codes/${id}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });

    expect((await del(used.id)).statusCode).toBe(409);
    expect((await del(unused.id)).statusCode).toBe(200);
  });

  it("lists paid uses and the total discount given", async () => {
    await defineCode({ code: "REPORT", type: "FIXED", value: 20_000 });
    const { token } = await customer();
    const order = (await placeOrder(token, "REPORT")).json().data.order;
    await markPaid(order.id);

    const res = await app.inject({
      method: "GET",
      url: "/api/v1/admin/discount-codes",
      headers: { authorization: `Bearer ${adminToken}` },
    });
    const row = res.json().data.discountCodes.find((c: { code: string }) => c.code === "REPORT");
    expect(row).toMatchObject({ paidUses: 1, totalDiscountGiven: 20_000 });
  });
});

describe("checking a code at checkout", () => {
  async function preview(token: string, code: string, subtotal: number) {
    return app.inject({
      method: "POST",
      url: "/api/v1/discount-codes/validate",
      headers: { authorization: `Bearer ${token}` },
      payload: { code, subtotal },
    });
  }

  it("says what the code takes off", async () => {
    await defineCode({ code: "TEN", value: 10, description: "ده درصد" });
    const { token } = await customer();

    const res = await preview(token, "ten", 250_000);

    expect(res.statusCode).toBe(200);
    expect(res.json().data).toMatchObject({ code: "TEN", discountAmount: 25_000, description: "ده درصد" });
  });

  it("gives the reason a code cannot be used", async () => {
    await defineCode({ code: "OFF", isActive: false });
    await defineCode({ code: "OLD", expiresAt: "2020-01-01T00:00:00.000Z" });
    await defineCode({ code: "LATER", startsAt: "2099-01-01T00:00:00.000Z" });
    await defineCode({ code: "BIG-ONLY", minOrderAmount: 1_000_000 });
    const { token } = await customer();

    const reason = async (code: string) => (await preview(token, code, 200_000)).json().error.message;
    expect(await reason("NOPE")).toContain("معتبر نیست");
    expect(await reason("OFF")).toContain("معتبر نیست");
    expect(await reason("OLD")).toContain("پایان");
    expect(await reason("LATER")).toContain("هنوز فعال نشده");
    expect(await reason("BIG-ONLY")).toContain("به بالا");
  });

  it("is only available to signed-in customers", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/discount-codes/validate",
      payload: { code: "TEN", subtotal: 1000 },
    });
    expect(res.statusCode).toBe(401);
  });
});

describe("ordering with a code", () => {
  it("takes the discount off the items and charges VAT on what is left", async () => {
    await prisma.setting.createMany({
      data: [
        { key: "vat_enabled", value: "true", group: "tax" },
        { key: "vat_percent", value: "10", group: "tax" },
      ],
    });
    await defineCode({ code: "TWENTY", value: 20 });
    const { token } = await customer();

    const res = await placeOrder(token, "twenty", 100_000, 2);

    expect(res.statusCode).toBe(201);
    const order = res.json().data.order;
    // 200,000 items − 40,000 discount = 160,000; VAT 10% = 16,000.
    expect(order.discountAmount).toBe(40_000);
    expect(order.discountCode).toBe("TWENTY");
    expect(order.taxAmount).toBe(16_000);
    expect(order.finalAmount).toBe(160_000 + order.shippingCost + 16_000);
  });

  it("fails the order with the reason when the code is not valid", async () => {
    const { token } = await customer();
    const res = await placeOrder(token, "MISSING");
    expect(res.statusCode).toBe(400);
    expect(res.json().error.message).toContain("کد تخفیف");
    expect(await prisma.order.count()).toBe(0);
  });

  it("lets each customer use a code once by default", async () => {
    await defineCode({ code: "ONCE-EACH", type: "FIXED", value: 10_000 });
    const a = await customer();
    const b = await customer();

    expect((await placeOrder(a.token, "ONCE-EACH")).statusCode).toBe(201);
    const again = await placeOrder(a.token, "ONCE-EACH");
    expect(again.statusCode).toBe(400);
    expect(again.json().error.message).toContain("قبلاً");
    expect((await placeOrder(b.token, "ONCE-EACH")).statusCode).toBe(201);
  });

  it("stops at the total limit, and a cancelled order gives its use back", async () => {
    await defineCode({ code: "LAST-ONE", usageLimit: 1, perUserLimit: null });
    const a = await customer();
    const b = await customer();

    const first = (await placeOrder(a.token, "LAST-ONE")).json().data.order;
    const blocked = await placeOrder(b.token, "LAST-ONE");
    expect(blocked.statusCode).toBe(400);
    expect(blocked.json().error.message).toContain("ظرفیت");

    await app.inject({
      method: "POST",
      url: `/api/v1/admin/orders/${first.id}/cancel`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {},
    });
    expect((await placeOrder(b.token, "LAST-ONE")).statusCode).toBe(201);
  });

  it("releases the use of an order left unpaid for over an hour", async () => {
    await defineCode({ code: "HOLD", usageLimit: 1, perUserLimit: null });
    const a = await customer();
    const b = await customer();
    const first = (await placeOrder(a.token, "HOLD")).json().data.order;

    await prisma.order.update({
      where: { id: first.id },
      data: { createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000) },
    });

    expect((await placeOrder(b.token, "HOLD")).statusCode).toBe(201);
  });

  it("lets only one of two simultaneous checkouts take the last use", async () => {
    await defineCode({ code: "RACE", usageLimit: 1, perUserLimit: null });
    const a = await customer();
    const b = await customer();

    const results = await Promise.all([placeOrder(a.token, "RACE"), placeOrder(b.token, "RACE")]);

    expect(results.map((r) => r.statusCode).sort()).toEqual([201, 400]);
  });

  it("refuses to take payment for an old unpaid order whose code has since run out", async () => {
    await defineCode({ code: "STALE", usageLimit: 1, perUserLimit: null });
    const a = await customer();
    const b = await customer();
    const old = (await placeOrder(a.token, "STALE")).json().data.order;
    await prisma.order.update({
      where: { id: old.id },
      data: { createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000) },
    });
    // Someone else uses it, and pays.
    const other = (await placeOrder(b.token, "STALE")).json().data.order;
    await markPaid(other.id);

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/payments/request",
      headers: { authorization: `Bearer ${a.token}` },
      payload: { orderId: old.id },
    });

    expect(res.statusCode).toBe(409);
    expect(res.json().error.message).toContain("دوباره ثبت");
  });

  it("orders without a code are unchanged", async () => {
    const { token } = await customer();
    const order = (await placeOrder(token)).json().data.order;
    expect(order.discountAmount).toBe(0);
    expect(order.discountCode).toBeNull();
  });
});
