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

function auth(token: string) {
  return { authorization: `Bearer ${token}` };
}

async function createAddress(
  app: FastifyInstance,
  token: string,
  overrides: Record<string, unknown> = {},
) {
  const res = await app.inject({
    method: "POST",
    url: "/api/v1/addresses",
    headers: auth(token),
    payload: { ...validShippingAddress(), ...overrides },
  });
  return res;
}

describe("POST /api/v1/addresses", () => {
  it("creates an address and makes the first one the default", async () => {
    const app = await buildTestApp();
    const { user } = await createTestUser();
    const token = getAuthToken(app, user);

    const res = await createAddress(app, token, { title: "خانه" });

    expect(res.statusCode).toBe(201);
    const address = res.json().data.address;
    expect(address.title).toBe("خانه");
    // Nothing else exists to fall back to at checkout.
    expect(address.isDefault).toBe(true);
    expect(address.isSaved).toBe(true);
    await app.close();
  });

  it("leaves a second address non-default unless asked", async () => {
    const app = await buildTestApp();
    const { user } = await createTestUser();
    const token = getAuthToken(app, user);

    await createAddress(app, token);
    const res = await createAddress(app, token, { title: "محل کار" });

    expect(res.json().data.address.isDefault).toBe(false);
    await app.close();
  });

  it("moves the default when a new address claims it", async () => {
    const app = await buildTestApp();
    const { user } = await createTestUser();
    const token = getAuthToken(app, user);

    const first = (await createAddress(app, token)).json().data.address;
    await createAddress(app, token, { isDefault: true });

    const reloaded = await prisma.address.findUnique({ where: { id: first.id } });
    expect(reloaded?.isDefault).toBe(false);
    await app.close();
  });

  it("rejects an address with no recipient name", async () => {
    const app = await buildTestApp();
    const { user } = await createTestUser();
    const token = getAuthToken(app, user);

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/addresses",
      headers: auth(token),
      payload: validShippingAddress({ recipientName: "" }),
    });

    expect(res.statusCode).toBe(422);
    await app.close();
  });

  it("requires authentication", async () => {
    const app = await buildTestApp();

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/addresses",
      payload: validShippingAddress(),
    });

    expect(res.statusCode).toBe(401);
    await app.close();
  });
});

describe("GET /api/v1/addresses", () => {
  it("lists only the caller's own addresses, default first", async () => {
    const app = await buildTestApp();
    const { user } = await createTestUser();
    const { user: stranger } = await createTestUser();
    const token = getAuthToken(app, user);

    await createAddress(app, token, { title: "اول" });
    await createAddress(app, token, { title: "دوم", isDefault: true });
    await createAddress(app, getAuthToken(app, stranger), { title: "غریبه" });

    const res = await app.inject({ method: "GET", url: "/api/v1/addresses", headers: auth(token) });

    const addresses = res.json().data.addresses;
    expect(addresses).toHaveLength(2);
    expect(addresses[0].title).toBe("دوم");
    expect(addresses.map((a: { title: string }) => a.title)).not.toContain("غریبه");
    await app.close();
  });

  it("excludes the per-order snapshot written at checkout", async () => {
    const app = await buildTestApp();
    const { user } = await createTestUser();
    const token = getAuthToken(app, user);
    const product = await createTestProduct({ price: 10_000, stockQuantity: 5 });

    await app.inject({
      method: "POST",
      url: "/api/v1/orders",
      headers: auth(token),
      payload: {
        items: [{ productId: product.id, quantity: 1 }],
        shippingAddress: validShippingAddress({ recipientName: "گیرنده سفارش" }),
      },
    });

    const res = await app.inject({ method: "GET", url: "/api/v1/addresses", headers: auth(token) });

    // Otherwise the book would gain an entry on every purchase.
    expect(res.json().data.addresses).toHaveLength(0);
    await app.close();
  });

  it("includes a checkout address the user asked to save", async () => {
    const app = await buildTestApp();
    const { user } = await createTestUser();
    const token = getAuthToken(app, user);
    const product = await createTestProduct({ price: 10_000, stockQuantity: 5 });

    await app.inject({
      method: "POST",
      url: "/api/v1/orders",
      headers: auth(token),
      payload: {
        items: [{ productId: product.id, quantity: 1 }],
        shippingAddress: validShippingAddress({ recipientName: "ذخیره شود" }),
        saveAddress: true,
      },
    });

    const res = await app.inject({ method: "GET", url: "/api/v1/addresses", headers: auth(token) });

    const addresses = res.json().data.addresses;
    expect(addresses).toHaveLength(1);
    expect(addresses[0].recipientName).toBe("ذخیره شود");
    await app.close();
  });
});

describe("ordering from a saved address", () => {
  it("re-validates the stored address and refuses an incomplete one", async () => {
    const app = await buildTestApp();
    const { user } = await createTestUser();
    const token = getAuthToken(app, user);
    const product = await createTestProduct({ price: 10_000, stockQuantity: 5 });
    const address = (await createAddress(app, token)).json().data.address;

    // Written straight to the DB, bypassing the API schema — the shape a row
    // saved before a rule tightened would have.
    await prisma.address.update({
      where: { id: address.id },
      data: { phone: "123" },
    });

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/orders",
      headers: auth(token),
      payload: {
        items: [{ productId: product.id, quantity: 1 }],
        shippingAddressId: address.id,
      },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error.message).toContain("کامل نیست");

    // Stock must not move for an order that was never created.
    const reloaded = await prisma.product.findUnique({ where: { id: product.id } });
    expect(reloaded?.stockQuantity).toBe(5);
    await app.close();
  });

  it("accepts a complete saved address", async () => {
    const app = await buildTestApp();
    const { user } = await createTestUser();
    const token = getAuthToken(app, user);
    const product = await createTestProduct({ price: 10_000, stockQuantity: 5 });
    const address = (await createAddress(app, token)).json().data.address;

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/orders",
      headers: auth(token),
      payload: {
        items: [{ productId: product.id, quantity: 1 }],
        shippingAddressId: address.id,
      },
    });

    expect(res.statusCode).toBe(201);
    // The order carries its own snapshot, not the book entry itself.
    expect(res.json().data.order.shippingAddressId).not.toBe(address.id);
    await app.close();
  });
});

describe("PATCH /api/v1/addresses/:id", () => {
  it("updates a field the caller owns", async () => {
    const app = await buildTestApp();
    const { user } = await createTestUser();
    const token = getAuthToken(app, user);
    const address = (await createAddress(app, token)).json().data.address;

    const res = await app.inject({
      method: "PATCH",
      url: `/api/v1/addresses/${address.id}`,
      headers: auth(token),
      payload: { city: "تبریز" },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().data.address.city).toBe("تبریز");
    await app.close();
  });

  it("does not leak another user's address", async () => {
    const app = await buildTestApp();
    const { user } = await createTestUser();
    const { user: stranger } = await createTestUser();
    const address = (await createAddress(app, getAuthToken(app, user))).json().data.address;

    const res = await app.inject({
      method: "PATCH",
      url: `/api/v1/addresses/${address.id}`,
      headers: auth(getAuthToken(app, stranger)),
      payload: { city: "تبریز" },
    });

    // 404, not 403: a stranger should not learn the id exists.
    expect(res.statusCode).toBe(404);
    await app.close();
  });
});

describe("POST /api/v1/addresses/:id/default", () => {
  it("promotes one address and demotes the previous default", async () => {
    const app = await buildTestApp();
    const { user } = await createTestUser();
    const token = getAuthToken(app, user);
    const first = (await createAddress(app, token)).json().data.address;
    const second = (await createAddress(app, token)).json().data.address;

    const res = await app.inject({
      method: "POST",
      url: `/api/v1/addresses/${second.id}/default`,
      headers: auth(token),
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().data.address.isDefault).toBe(true);
    const reloaded = await prisma.address.findUnique({ where: { id: first.id } });
    expect(reloaded?.isDefault).toBe(false);
    await app.close();
  });
});

describe("DELETE /api/v1/addresses/:id", () => {
  it("deletes an unused address and promotes a replacement default", async () => {
    const app = await buildTestApp();
    const { user } = await createTestUser();
    const token = getAuthToken(app, user);
    const first = (await createAddress(app, token)).json().data.address;
    const second = (await createAddress(app, token)).json().data.address;

    const res = await app.inject({
      method: "DELETE",
      url: `/api/v1/addresses/${first.id}`,
      headers: auth(token),
    });

    expect(res.statusCode).toBe(200);
    expect(await prisma.address.findUnique({ where: { id: first.id } })).toBeNull();
    // The book must never be left without a default.
    const reloaded = await prisma.address.findUnique({ where: { id: second.id } });
    expect(reloaded?.isDefault).toBe(true);
    await app.close();
  });

  it("refuses to delete an address an order still points at", async () => {
    const app = await buildTestApp();
    const { user } = await createTestUser();
    const token = getAuthToken(app, user);
    const address = (await createAddress(app, token)).json().data.address;
    const product = await createTestProduct({ price: 10_000, stockQuantity: 5 });

    // Point an order straight at the book entry, which is what the FK
    // restriction actually guards against.
    const order = await prisma.order.create({
      data: {
        userId: user.id,
        orderNumber: `TEST-${Date.now()}`,
        totalAmount: 10_000,
        shippingCost: 0,
        finalAmount: 10_000,
        shippingAddressId: address.id,
        items: {
          create: [
            {
              productId: product.id,
              quantity: 1,
              unitPrice: 10_000,
              totalPrice: 10_000,
              productTitle: product.title,
            },
          ],
        },
      },
    });

    const res = await app.inject({
      method: "DELETE",
      url: `/api/v1/addresses/${address.id}`,
      headers: auth(token),
    });

    expect(res.statusCode).toBe(409);
    expect(res.json().error.message).toContain("سفارش");

    await prisma.orderItem.deleteMany({ where: { orderId: order.id } });
    await prisma.order.delete({ where: { id: order.id } });
    await app.close();
  });
});
