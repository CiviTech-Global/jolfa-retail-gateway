import { beforeEach, describe, expect, it } from "vitest";
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

/**
 * The postal code has to survive the whole way from checkout to both order
 * screens. It did reach the database — real orders on the live site all hold a
 * ten-digit code — but nothing held the two read paths still, and the admin
 * screen had quietly never rendered it, leaving the person packing the parcel
 * without the one field Iran Post requires.
 */
describe("the postal code on an order", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await createTestApp();
  });

  async function placeOrder(token: string, postalCode = "1665876754") {
    const product = await createTestProduct({ price: 50_000, stockQuantity: 5 });
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/orders",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        items: [{ productId: product.id, quantity: 1 }],
        shippingAddress: validShippingAddress({ postalCode }),
        shippingMethod: "POST",
      },
    });
    expect(res.statusCode).toBe(201);
    return res.json().data.order as { id: string };
  }

  it("is stored on the order's own address snapshot", async () => {
    const { user } = await createTestUser();
    const order = await placeOrder(getAuthToken(app, user));

    const snapshot = await prisma.order.findUnique({
      where: { id: order.id },
      select: { shippingAddress: { select: { postalCode: true, isSaved: true } } },
    });

    expect(snapshot?.shippingAddress.postalCode).toBe("1665876754");
    // The snapshot, not a book entry: editing the book must not rewrite it.
    expect(snapshot?.shippingAddress.isSaved).toBe(false);
  });

  it("reaches the customer's own order page", async () => {
    const { user } = await createTestUser();
    const token = getAuthToken(app, user);
    const order = await placeOrder(token);

    const res = await app.inject({
      method: "GET",
      url: `/api/v1/orders/${order.id}`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().data.order.shippingAddress.postalCode).toBe("1665876754");
  });

  it("reaches the admin's order page", async () => {
    const { user } = await createTestUser();
    const order = await placeOrder(getAuthToken(app, user));

    const { user: admin } = await createTestAdmin();
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/admin/orders/${order.id}`,
      headers: { authorization: `Bearer ${getAuthToken(app, admin)}` },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().data.order.shippingAddress.postalCode).toBe("1665876754");
  });

  // Normalisation happens at the edge, so a code typed on a Persian keyboard
  // must not be stored in a form the post office cannot read.
  it("stores Persian digits as ASCII", async () => {
    const { user } = await createTestUser();
    const order = await placeOrder(getAuthToken(app, user), "۱۶۶۵۸۷۶۷۵۴");

    const snapshot = await prisma.order.findUnique({
      where: { id: order.id },
      select: { shippingAddress: { select: { postalCode: true } } },
    });
    expect(snapshot?.shippingAddress.postalCode).toBe("1665876754");
  });

  it("refuses an order with no postal code", async () => {
    const { user } = await createTestUser();
    const token = getAuthToken(app, user);
    const product = await createTestProduct({ price: 50_000, stockQuantity: 5 });

    const address = validShippingAddress();
    delete address.postalCode;

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/orders",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        items: [{ productId: product.id, quantity: 1 }],
        shippingAddress: address,
        shippingMethod: "POST",
      },
    });

    expect(res.statusCode).toBeGreaterThanOrEqual(400);
  });
});
