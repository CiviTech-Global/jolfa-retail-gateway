import { describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { createTestApp } from "../../../test/helpers/build-app.js";
import {
  createTestProduct,
  createTestUser,
  getAuthToken,
  validShippingAddress,
} from "../../../test/helpers/factories.js";
import { prisma } from "../../shared/prisma.js";

async function buildTestApp(): Promise<FastifyInstance> {
  return createTestApp();
}

function placeOrder(app: FastifyInstance, token: string, productId: string, quantity: number) {
  return app.inject({
    method: "POST",
    url: "/api/v1/orders",
    headers: { authorization: `Bearer ${token}` },
    payload: {
      items: [{ productId, quantity }],
      shippingAddress: validShippingAddress(),
      shippingMethod: "POST",
    },
  });
}

describe("order creation under concurrency", () => {
  /**
   * The race flagged in docs/testing/03-checkout-payment.md: two shoppers
   * checking out the last unit at the same time. Stock must never go negative,
   * and exactly one order may be created.
   */
  it("lets only ONE of two simultaneous buyers take the last unit", async () => {
    const app = await buildTestApp();
    const { user: buyerA } = await createTestUser();
    const { user: buyerB } = await createTestUser();
    const product = await createTestProduct({ stockQuantity: 1 });

    const [resA, resB] = await Promise.all([
      placeOrder(app, getAuthToken(app, buyerA), product.id, 1),
      placeOrder(app, getAuthToken(app, buyerB), product.id, 1),
    ]);

    const statuses = [resA.statusCode, resB.statusCode].sort();
    expect(statuses).toEqual([201, 409]);

    const after = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });
    expect(after.stockQuantity).toBe(0);
    expect(after.stockQuantity).toBeGreaterThanOrEqual(0);

    expect(await prisma.order.count()).toBe(1);
    await app.close();
  });

  it("never drives stock negative when many buyers race for a small supply", async () => {
    const app = await buildTestApp();
    const product = await createTestProduct({ stockQuantity: 3 });
    const buyers = await Promise.all(
      Array.from({ length: 8 }, () => createTestUser().then((r) => r.user)),
    );

    const results = await Promise.all(
      buyers.map((buyer) => placeOrder(app, getAuthToken(app, buyer), product.id, 1)),
    );

    const created = results.filter((r) => r.statusCode === 201).length;
    const rejected = results.filter((r) => r.statusCode === 409).length;

    expect(created).toBe(3);
    expect(rejected).toBe(5);

    const after = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });
    expect(after.stockQuantity).toBe(0);
    expect(await prisma.order.count()).toBe(3);
    await app.close();
  });

  it("leaves no partial Address/Order rows behind when an item is rejected", async () => {
    const app = await buildTestApp();
    const { user } = await createTestUser();
    const inStock = await createTestProduct({ stockQuantity: 5 });
    const outOfStock = await createTestProduct({ stockQuantity: 0 });

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/orders",
      headers: { authorization: `Bearer ${getAuthToken(app, user)}` },
      payload: {
        items: [
          { productId: inStock.id, quantity: 1 },
          { productId: outOfStock.id, quantity: 1 },
        ],
        shippingAddress: validShippingAddress(),
        shippingMethod: "POST",
      },
    });

    expect(res.statusCode).toBe(409);
    expect(await prisma.order.count()).toBe(0);
    expect(await prisma.orderItem.count()).toBe(0);
    expect(await prisma.address.count()).toBe(0);
    // The in-stock item must not have been decremented by the failed attempt.
    expect((await prisma.product.findUniqueOrThrow({ where: { id: inStock.id } })).stockQuantity)
      .toBe(5);
    await app.close();
  });

  it("decrements each line independently for a multi-item order", async () => {
    const app = await buildTestApp();
    const { user } = await createTestUser();
    const first = await createTestProduct({ stockQuantity: 10 });
    const second = await createTestProduct({ stockQuantity: 4 });

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/orders",
      headers: { authorization: `Bearer ${getAuthToken(app, user)}` },
      payload: {
        items: [
          { productId: first.id, quantity: 3 },
          { productId: second.id, quantity: 4 },
        ],
        shippingAddress: validShippingAddress(),
        shippingMethod: "POST",
      },
    });

    expect(res.statusCode).toBe(201);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: first.id } })).stockQuantity)
      .toBe(7);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: second.id } })).stockQuantity)
      .toBe(0);
    await app.close();
  });
});
