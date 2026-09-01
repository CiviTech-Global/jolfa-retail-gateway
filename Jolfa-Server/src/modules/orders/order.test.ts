import { describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { createTestApp } from "../../../test/helpers/build-app.js";
import {
  createTestUser,
  createTestProduct,
  getAuthToken,
  validShippingAddress,
} from "../../../test/helpers/factories.js";
import { prisma } from "../../shared/prisma.js";

async function buildTestApp(): Promise<FastifyInstance> {
  return createTestApp();
}

describe("POST /api/v1/orders", () => {
  it("creates an order with a valid single item (CP-005)", async () => {
    const app = await buildTestApp();
    const { user } = await createTestUser();
    const token = getAuthToken(app, user);
    const product = await createTestProduct({ price: 50_000, stockQuantity: 5 });

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/orders",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        items: [{ productId: product.id, quantity: 2 }],
        shippingAddress: validShippingAddress(),
        shippingMethod: "POST",
        customerNote: "لطفا با احتیاط بسته‌بندی شود",
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.data.order.totalAmount).toBe(100_000);
    expect(body.data.order.shippingCost).toBe(80_000);
    expect(body.data.order.finalAmount).toBe(180_000);
    expect(body.data.order.notes).toBe("لطفا با احتیاط بسته‌بندی شود");
    await app.close();
  });

  it("uses courier shipping cost of 150000 when shippingMethod is COURIER", async () => {
    const app = await buildTestApp();
    const { user } = await createTestUser();
    const token = getAuthToken(app, user);
    const product = await createTestProduct({ price: 10_000, stockQuantity: 5 });

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/orders",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        items: [{ productId: product.id, quantity: 1 }],
        shippingAddress: validShippingAddress(),
        shippingMethod: "COURIER",
      },
    });

    expect(res.statusCode).toBe(201);
    expect(res.json().data.order.shippingCost).toBe(150_000);
    await app.close();
  });

  it("succeeds when quantity equals remaining stock, leaving stock at 0 (CP-009)", async () => {
    const app = await buildTestApp();
    const { user } = await createTestUser();
    const token = getAuthToken(app, user);
    const product = await createTestProduct({ stockQuantity: 3 });

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/orders",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        items: [{ productId: product.id, quantity: 3 }],
        shippingAddress: validShippingAddress(),
      },
    });

    expect(res.statusCode).toBe(201);
    const updated = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });
    expect(updated.stockQuantity).toBe(0);
    await app.close();
  });

  it("rejects an item quantity exceeding available stock with 409 (CP-024)", async () => {
    const app = await buildTestApp();
    const { user } = await createTestUser();
    const token = getAuthToken(app, user);
    const product = await createTestProduct({ stockQuantity: 2 });

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/orders",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        items: [{ productId: product.id, quantity: 3 }],
        shippingAddress: validShippingAddress(),
      },
    });

    expect(res.statusCode).toBe(409);
    const untouched = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });
    expect(untouched.stockQuantity).toBe(2);
    const orderCount = await prisma.order.count();
    expect(orderCount).toBe(0);
    await app.close();
  });

  it("rejects an item referencing an inactive product (CP-013)", async () => {
    const app = await buildTestApp();
    const { user } = await createTestUser();
    const token = getAuthToken(app, user);
    const product = await createTestProduct({ isActive: false });

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/orders",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        items: [{ productId: product.id, quantity: 1 }],
        shippingAddress: validShippingAddress(),
      },
    });

    expect(res.statusCode).toBe(400);
    expect(await prisma.order.count()).toBe(0);
    await app.close();
  });

  it("rejects an item referencing a non-existent product id (CP-014)", async () => {
    const app = await buildTestApp();
    const { user } = await createTestUser();
    const token = getAuthToken(app, user);

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/orders",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        items: [{ productId: "00000000-0000-0000-0000-000000000000", quantity: 1 }],
        shippingAddress: validShippingAddress(),
      },
    });

    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it("rejects a request missing required shipping fields with 422", async () => {
    const app = await buildTestApp();
    const { user } = await createTestUser();
    const token = getAuthToken(app, user);
    const product = await createTestProduct();

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/orders",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        items: [{ productId: product.id, quantity: 1 }],
        shippingAddress: { recipientName: "علی" },
      },
    });

    expect(res.statusCode).toBe(422);
    await app.close();
  });

  it("rejects an unauthenticated request with 401", async () => {
    const app = await buildTestApp();
    const product = await createTestProduct();

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/orders",
      payload: {
        items: [{ productId: product.id, quantity: 1 }],
        shippingAddress: validShippingAddress(),
      },
    });

    expect(res.statusCode).toBe(401);
    await app.close();
  });
});

describe("GET /api/v1/orders/:id", () => {
  it("returns items matching product titles/quantities/prices at purchase time (CP-023)", async () => {
    const app = await buildTestApp();
    const { user } = await createTestUser();
    const token = getAuthToken(app, user);
    const product = await createTestProduct({ title: "چای سیاه ارگانیک", price: 75_000, stockQuantity: 5 });

    const createRes = await app.inject({
      method: "POST",
      url: "/api/v1/orders",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        items: [{ productId: product.id, quantity: 2 }],
        shippingAddress: validShippingAddress(),
      },
    });
    const orderId = createRes.json().data.order.id;

    await prisma.product.update({ where: { id: product.id }, data: { title: "نام تغییر یافته" } });

    const res = await app.inject({
      method: "GET",
      url: `/api/v1/orders/${orderId}`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const item = res.json().data.order.items[0];
    expect(item.productTitle).toBe("چای سیاه ارگانیک");
    expect(item.quantity).toBe(2);
    expect(item.unitPrice).toBe(75_000);
    await app.close();
  });

  it("rejects a customer fetching another user's order with 403", async () => {
    const app = await buildTestApp();
    const { user: owner } = await createTestUser();
    const ownerToken = getAuthToken(app, owner);
    const product = await createTestProduct({ stockQuantity: 5 });

    const createRes = await app.inject({
      method: "POST",
      url: "/api/v1/orders",
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        items: [{ productId: product.id, quantity: 1 }],
        shippingAddress: validShippingAddress(),
      },
    });
    const orderId = createRes.json().data.order.id;

    const { user: intruder } = await createTestUser();
    const intruderToken = getAuthToken(app, intruder);

    const res = await app.inject({
      method: "GET",
      url: `/api/v1/orders/${orderId}`,
      headers: { authorization: `Bearer ${intruderToken}` },
    });

    expect(res.statusCode).toBe(403);
    await app.close();
  });

  it("returns 404 for a non-existent order id", async () => {
    const app = await buildTestApp();
    const { user } = await createTestUser();
    const token = getAuthToken(app, user);

    const res = await app.inject({
      method: "GET",
      url: "/api/v1/orders/00000000-0000-0000-0000-000000000000",
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(404);
    await app.close();
  });
});

describe("GET /api/v1/orders", () => {
  it("lists only the authenticated user's own orders", async () => {
    const app = await buildTestApp();
    const { user: userA } = await createTestUser();
    const { user: userB } = await createTestUser();
    const tokenA = getAuthToken(app, userA);
    const tokenB = getAuthToken(app, userB);
    const product = await createTestProduct({ stockQuantity: 10 });

    await app.inject({
      method: "POST",
      url: "/api/v1/orders",
      headers: { authorization: `Bearer ${tokenA}` },
      payload: { items: [{ productId: product.id, quantity: 1 }], shippingAddress: validShippingAddress() },
    });
    await app.inject({
      method: "POST",
      url: "/api/v1/orders",
      headers: { authorization: `Bearer ${tokenB}` },
      payload: { items: [{ productId: product.id, quantity: 1 }], shippingAddress: validShippingAddress() },
    });

    const res = await app.inject({
      method: "GET",
      url: "/api/v1/orders",
      headers: { authorization: `Bearer ${tokenA}` },
    });

    expect(res.statusCode).toBe(200);
    const orders = res.json().data.orders;
    expect(orders).toHaveLength(1);
    expect(orders[0].userId).toBe(userA.id);
    await app.close();
  });
});
