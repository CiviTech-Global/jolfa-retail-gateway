import { describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { createTestApp } from "../../../test/helpers/build-app.js";
import {
  createTestAdmin,
  createTestOrder,
  createTestProduct,
  createTestUser,
  getAuthToken,
} from "../../../test/helpers/factories.js";
import { prisma } from "../../shared/prisma.js";

async function buildTestApp(): Promise<FastifyInstance> {
  return createTestApp();
}

const ADMIN = "/api/v1/admin";

describe("GET /api/v1/admin/orders", () => {
  it("rejects anonymous with 401 and CUSTOMER with 403", async () => {
    const app = await buildTestApp();
    const { user } = await createTestUser();

    expect((await app.inject({ method: "GET", url: `${ADMIN}/orders` })).statusCode).toBe(401);

    const forbidden = await app.inject({
      method: "GET",
      url: `${ADMIN}/orders`,
      headers: { authorization: `Bearer ${getAuthToken(app, user)}` },
    });
    expect(forbidden.statusCode).toBe(403);
    await app.close();
  });

  it("lists orders from every customer for an admin", async () => {
    const app = await buildTestApp();
    const { user: a } = await createTestUser();
    const { user: b } = await createTestUser();
    const { user: admin } = await createTestAdmin();
    await createTestOrder(a.id);
    await createTestOrder(b.id);

    const res = await app.inject({
      method: "GET",
      url: `${ADMIN}/orders`,
      headers: { authorization: `Bearer ${getAuthToken(app, admin)}` },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().data.meta.total).toBe(2);
    await app.close();
  });

  it("filters by status", async () => {
    const app = await buildTestApp();
    const { user } = await createTestUser();
    const { user: admin } = await createTestAdmin();
    await createTestOrder(user.id, { status: "PENDING" });
    const shipped = await createTestOrder(user.id, { status: "SHIPPED" });

    const res = await app.inject({
      method: "GET",
      url: `${ADMIN}/orders?status=SHIPPED`,
      headers: { authorization: `Bearer ${getAuthToken(app, admin)}` },
    });

    const orders = res.json().data.orders as { id: string }[];
    expect(orders).toHaveLength(1);
    expect(orders[0]?.id).toBe(shipped.id);
    await app.close();
  });

  it("rejects an unrecognised status filter with 422", async () => {
    const app = await buildTestApp();
    const { user: admin } = await createTestAdmin();

    const res = await app.inject({
      method: "GET",
      url: `${ADMIN}/orders?status=NOPE`,
      headers: { authorization: `Bearer ${getAuthToken(app, admin)}` },
    });

    expect(res.statusCode).toBe(422);
    await app.close();
  });
});

describe("PATCH /api/v1/admin/orders/:id/status", () => {
  it("advances status, records history, and writes a STATUS_CHANGE audit row", async () => {
    const app = await buildTestApp();
    const { user } = await createTestUser();
    const { user: admin } = await createTestAdmin();
    const order = await createTestOrder(user.id, { status: "PROCESSING" });

    const res = await app.inject({
      method: "PATCH",
      url: `${ADMIN}/orders/${order.id}/status`,
      headers: { authorization: `Bearer ${getAuthToken(app, admin)}` },
      payload: { status: "SHIPPED", note: "ارسال شد" },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().data.order.status).toBe("SHIPPED");

    const history = await prisma.orderStatusHistory.findMany({ where: { orderId: order.id } });
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({
      previousStatus: "PROCESSING",
      newStatus: "SHIPPED",
      changedById: admin.id,
      note: "ارسال شد",
    });

    const audits = await prisma.auditLog.findMany({ where: { action: "STATUS_CHANGE" } });
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({ entityType: "Order", entityId: order.id, userId: admin.id });
    await app.close();
  });

  it("appends the note to the order's notes rather than replacing them", async () => {
    const app = await buildTestApp();
    const { user } = await createTestUser();
    const { user: admin } = await createTestAdmin();
    const order = await createTestOrder(user.id);
    await prisma.order.update({ where: { id: order.id }, data: { notes: "یادداشت اولیه" } });

    await app.inject({
      method: "PATCH",
      url: `${ADMIN}/orders/${order.id}/status`,
      headers: { authorization: `Bearer ${getAuthToken(app, admin)}` },
      payload: { status: "PROCESSING", note: "افزوده شد" },
    });

    const updated = await prisma.order.findUnique({ where: { id: order.id } });
    expect(updated?.notes).toContain("یادداشت اولیه");
    expect(updated?.notes).toContain("افزوده شد");
    await app.close();
  });

  it("records each step of a full PENDING->DELIVERED progression", async () => {
    const app = await buildTestApp();
    const { user } = await createTestUser();
    const { user: admin } = await createTestAdmin();
    const token = getAuthToken(app, admin);
    const order = await createTestOrder(user.id, { status: "PENDING" });

    for (const status of ["PROCESSING", "SHIPPED", "DELIVERED"]) {
      const res = await app.inject({
        method: "PATCH",
        url: `${ADMIN}/orders/${order.id}/status`,
        headers: { authorization: `Bearer ${token}` },
        payload: { status },
      });
      expect(res.statusCode).toBe(200);
    }

    const history = await prisma.orderStatusHistory.findMany({
      where: { orderId: order.id },
      orderBy: { createdAt: "asc" },
    });
    expect(history.map((h) => h.newStatus)).toEqual(["PROCESSING", "SHIPPED", "DELIVERED"]);
    await app.close();
  });

  /**
   * KNOWN GAP — pins CURRENT behaviour, not desired behaviour.
   *
   * `updateOrderStatus()` performs no state-machine validation, so a direct API
   * call can jump PENDING -> DELIVERED, skipping PROCESSING and SHIPPED. The
   * admin UI hides this, but the endpoint does not enforce it. Flip this test
   * to expect a 4xx once the legal-transition rules are decided.
   * See docs/testing/10-known-gaps.md.
   */
  it("currently ACCEPTS an out-of-sequence PENDING->DELIVERED jump (no server-side state machine)", async () => {
    const app = await buildTestApp();
    const { user } = await createTestUser();
    const { user: admin } = await createTestAdmin();
    const order = await createTestOrder(user.id, { status: "PENDING" });

    const res = await app.inject({
      method: "PATCH",
      url: `${ADMIN}/orders/${order.id}/status`,
      headers: { authorization: `Bearer ${getAuthToken(app, admin)}` },
      payload: { status: "DELIVERED" },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().data.order.status).toBe("DELIVERED");
    await app.close();
  });

  /** Same gap, backwards: DELIVERED -> PENDING is also currently permitted. */
  it("currently ACCEPTS a backwards DELIVERED->PENDING transition", async () => {
    const app = await buildTestApp();
    const { user } = await createTestUser();
    const { user: admin } = await createTestAdmin();
    const order = await createTestOrder(user.id, { status: "DELIVERED" });

    const res = await app.inject({
      method: "PATCH",
      url: `${ADMIN}/orders/${order.id}/status`,
      headers: { authorization: `Bearer ${getAuthToken(app, admin)}` },
      payload: { status: "PENDING" },
    });

    expect(res.statusCode).toBe(200);
    await app.close();
  });

  it("rejects an unknown status value with 422", async () => {
    const app = await buildTestApp();
    const { user } = await createTestUser();
    const { user: admin } = await createTestAdmin();
    const order = await createTestOrder(user.id);

    const res = await app.inject({
      method: "PATCH",
      url: `${ADMIN}/orders/${order.id}/status`,
      headers: { authorization: `Bearer ${getAuthToken(app, admin)}` },
      payload: { status: "TELEPORTED" },
    });

    expect(res.statusCode).toBe(422);
    await app.close();
  });

  it("returns 404 for an unknown order and 403 for a CUSTOMER", async () => {
    const app = await buildTestApp();
    const { user } = await createTestUser();
    const { user: admin } = await createTestAdmin();
    const order = await createTestOrder(user.id);

    const missing = await app.inject({
      method: "PATCH",
      url: `${ADMIN}/orders/00000000-0000-4000-8000-000000000000/status`,
      headers: { authorization: `Bearer ${getAuthToken(app, admin)}` },
      payload: { status: "PROCESSING" },
    });
    expect(missing.statusCode).toBe(404);

    const forbidden = await app.inject({
      method: "PATCH",
      url: `${ADMIN}/orders/${order.id}/status`,
      headers: { authorization: `Bearer ${getAuthToken(app, user)}` },
      payload: { status: "PROCESSING" },
    });
    expect(forbidden.statusCode).toBe(403);
    await app.close();
  });
});

describe("GET /api/v1/admin/orders/:id", () => {
  it("returns full detail including items, address, payment and history", async () => {
    const app = await buildTestApp();
    const { user } = await createTestUser();
    const { user: admin } = await createTestAdmin();
    const product = await createTestProduct({ price: 20_000 });
    const order = await createTestOrder(user.id, { items: [{ product, quantity: 2 }] });

    const res = await app.inject({
      method: "GET",
      url: `${ADMIN}/orders/${order.id}`,
      headers: { authorization: `Bearer ${getAuthToken(app, admin)}` },
    });

    expect(res.statusCode).toBe(200);
    const detail = res.json().data.order;
    expect(detail.items).toHaveLength(1);
    expect(detail.items[0]).toMatchObject({ quantity: 2, unitPrice: 20_000 });
    expect(detail.shippingAddress).toBeTruthy();
    expect(detail.user.id).toBe(user.id);
    expect(detail.statusHistory).toEqual([]);
    await app.close();
  });

  it("returns 404 for an unknown id and 403 for a CUSTOMER", async () => {
    const app = await buildTestApp();
    const { user } = await createTestUser();
    const { user: admin } = await createTestAdmin();

    const missing = await app.inject({
      method: "GET",
      url: `${ADMIN}/orders/00000000-0000-4000-8000-000000000000`,
      headers: { authorization: `Bearer ${getAuthToken(app, admin)}` },
    });
    expect(missing.statusCode).toBe(404);

    const forbidden = await app.inject({
      method: "GET",
      url: `${ADMIN}/orders/00000000-0000-4000-8000-000000000000`,
      headers: { authorization: `Bearer ${getAuthToken(app, user)}` },
    });
    expect(forbidden.statusCode).toBe(403);
    await app.close();
  });
});

describe("PATCH /api/v1/admin/orders/:id/tracking", () => {
  it("persists the tracking number and writes an audit row", async () => {
    const app = await buildTestApp();
    const { user } = await createTestUser();
    const { user: admin } = await createTestAdmin();
    const order = await createTestOrder(user.id);

    const res = await app.inject({
      method: "PATCH",
      url: `${ADMIN}/orders/${order.id}/tracking`,
      headers: { authorization: `Bearer ${getAuthToken(app, admin)}` },
      payload: { trackingNumber: "IR-123456789" },
    });

    expect(res.statusCode).toBe(200);
    const stored = await prisma.order.findUnique({ where: { id: order.id } });
    expect(stored?.trackingNumber).toBe("IR-123456789");

    const audits = await prisma.auditLog.findMany({
      where: { entityType: "Order", action: "UPDATE" },
    });
    expect(audits).toHaveLength(1);
    await app.close();
  });

  it("is visible to the owning customer on their own order", async () => {
    const app = await buildTestApp();
    const { user } = await createTestUser();
    const { user: admin } = await createTestAdmin();
    const order = await createTestOrder(user.id);

    await app.inject({
      method: "PATCH",
      url: `${ADMIN}/orders/${order.id}/tracking`,
      headers: { authorization: `Bearer ${getAuthToken(app, admin)}` },
      payload: { trackingNumber: "IR-987" },
    });

    const res = await app.inject({
      method: "GET",
      url: `/api/v1/orders/${order.id}`,
      headers: { authorization: `Bearer ${getAuthToken(app, user)}` },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().data.order.trackingNumber).toBe("IR-987");
    await app.close();
  });

  it("rejects an empty tracking number with 422 and a CUSTOMER with 403", async () => {
    const app = await buildTestApp();
    const { user } = await createTestUser();
    const { user: admin } = await createTestAdmin();
    const order = await createTestOrder(user.id);

    const invalid = await app.inject({
      method: "PATCH",
      url: `${ADMIN}/orders/${order.id}/tracking`,
      headers: { authorization: `Bearer ${getAuthToken(app, admin)}` },
      payload: { trackingNumber: "" },
    });
    expect(invalid.statusCode).toBe(422);

    const forbidden = await app.inject({
      method: "PATCH",
      url: `${ADMIN}/orders/${order.id}/tracking`,
      headers: { authorization: `Bearer ${getAuthToken(app, user)}` },
      payload: { trackingNumber: "IR-1" },
    });
    expect(forbidden.statusCode).toBe(403);
    await app.close();
  });
});

describe("POST /api/v1/admin/orders/:id/cancel", () => {
  it("cancels an unpaid order, restocks every item, and records history", async () => {
    const app = await buildTestApp();
    const { user } = await createTestUser();
    const { user: admin } = await createTestAdmin();
    const product = await createTestProduct({ stockQuantity: 10 });
    // Simulate the stock already having been decremented at order time.
    await prisma.product.update({ where: { id: product.id }, data: { stockQuantity: 7 } });
    const order = await createTestOrder(user.id, { items: [{ product, quantity: 3 }] });

    const res = await app.inject({
      method: "POST",
      url: `${ADMIN}/orders/${order.id}/cancel`,
      headers: { authorization: `Bearer ${getAuthToken(app, admin)}` },
      payload: { reason: "موجودی ناکافی" },
    });

    expect(res.statusCode).toBe(200);

    const updated = await prisma.order.findUnique({ where: { id: order.id } });
    expect(updated?.status).toBe("CANCELLED");
    // Unpaid order -> paymentStatus becomes FAILED, not REFUNDED.
    expect(updated?.paymentStatus).toBe("FAILED");

    const restocked = await prisma.product.findUnique({ where: { id: product.id } });
    expect(restocked?.stockQuantity).toBe(10);

    const history = await prisma.orderStatusHistory.findMany({ where: { orderId: order.id } });
    expect(history[0]).toMatchObject({ newStatus: "CANCELLED", changedById: admin.id });
    await app.close();
  });

  it("marks a PAID order REFUNDED and creates a REFUND transaction", async () => {
    const app = await buildTestApp();
    const { user } = await createTestUser();
    const { user: admin } = await createTestAdmin();
    const token = getAuthToken(app, user);
    const order = await createTestOrder(user.id);

    // Pay for it through the real flow so a COMPLETED Payment exists.
    const requested = await app.inject({
      method: "POST",
      url: "/api/v1/payments/request",
      headers: { authorization: `Bearer ${token}` },
      payload: { orderId: order.id },
    });
    await app.inject({
      method: "POST",
      url: "/api/v1/payments/verify",
      payload: { authority: requested.json().data.authority, status: "OK" },
    });

    const res = await app.inject({
      method: "POST",
      url: `${ADMIN}/orders/${order.id}/cancel`,
      headers: { authorization: `Bearer ${getAuthToken(app, admin)}` },
      payload: { reason: "درخواست مشتری" },
    });

    expect(res.statusCode).toBe(200);
    const updated = await prisma.order.findUnique({ where: { id: order.id } });
    expect(updated?.paymentStatus).toBe("REFUNDED");

    const refunds = await prisma.transaction.findMany({
      where: { orderId: order.id, type: "REFUND" },
    });
    expect(refunds).toHaveLength(1);
    expect(refunds[0]).toMatchObject({ status: "COMPLETED", amount: order.finalAmount });
    await app.close();
  });

  it("does NOT create a refund transaction when the order was never paid", async () => {
    const app = await buildTestApp();
    const { user } = await createTestUser();
    const { user: admin } = await createTestAdmin();
    const order = await createTestOrder(user.id);

    await app.inject({
      method: "POST",
      url: `${ADMIN}/orders/${order.id}/cancel`,
      headers: { authorization: `Bearer ${getAuthToken(app, admin)}` },
      payload: {},
    });

    expect(await prisma.transaction.count({ where: { orderId: order.id, type: "REFUND" } })).toBe(0);
    await app.close();
  });

  it("rejects cancelling an already-CANCELLED order with 400", async () => {
    const app = await buildTestApp();
    const { user } = await createTestUser();
    const { user: admin } = await createTestAdmin();
    const order = await createTestOrder(user.id, { status: "CANCELLED" });

    const res = await app.inject({
      method: "POST",
      url: `${ADMIN}/orders/${order.id}/cancel`,
      headers: { authorization: `Bearer ${getAuthToken(app, admin)}` },
      payload: {},
    });

    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it("rejects cancelling a DELIVERED order with 400", async () => {
    const app = await buildTestApp();
    const { user } = await createTestUser();
    const { user: admin } = await createTestAdmin();
    const order = await createTestOrder(user.id, { status: "DELIVERED" });

    const res = await app.inject({
      method: "POST",
      url: `${ADMIN}/orders/${order.id}/cancel`,
      headers: { authorization: `Bearer ${getAuthToken(app, admin)}` },
      payload: {},
    });

    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it("does not restock twice if cancel is attempted again", async () => {
    const app = await buildTestApp();
    const { user } = await createTestUser();
    const { user: admin } = await createTestAdmin();
    const token = getAuthToken(app, admin);
    const product = await createTestProduct({ stockQuantity: 5 });
    const order = await createTestOrder(user.id, { items: [{ product, quantity: 2 }] });

    await app.inject({
      method: "POST",
      url: `${ADMIN}/orders/${order.id}/cancel`,
      headers: { authorization: `Bearer ${token}` },
      payload: {},
    });
    const afterFirst = await prisma.product.findUnique({ where: { id: product.id } });

    const second = await app.inject({
      method: "POST",
      url: `${ADMIN}/orders/${order.id}/cancel`,
      headers: { authorization: `Bearer ${token}` },
      payload: {},
    });

    expect(second.statusCode).toBe(400);
    const afterSecond = await prisma.product.findUnique({ where: { id: product.id } });
    expect(afterSecond?.stockQuantity).toBe(afterFirst?.stockQuantity);
    await app.close();
  });

  it("writes a CANCEL audit row and rejects a CUSTOMER with 403", async () => {
    const app = await buildTestApp();
    const { user } = await createTestUser();
    const { user: admin } = await createTestAdmin();
    const order = await createTestOrder(user.id);
    const other = await createTestOrder(user.id);

    await app.inject({
      method: "POST",
      url: `${ADMIN}/orders/${order.id}/cancel`,
      headers: { authorization: `Bearer ${getAuthToken(app, admin)}` },
      payload: {},
    });
    const audits = await prisma.auditLog.findMany({ where: { action: "CANCEL" } });
    expect(audits).toHaveLength(1);
    expect(audits[0]?.userId).toBe(admin.id);

    const forbidden = await app.inject({
      method: "POST",
      url: `${ADMIN}/orders/${other.id}/cancel`,
      headers: { authorization: `Bearer ${getAuthToken(app, user)}` },
      payload: {},
    });
    expect(forbidden.statusCode).toBe(403);
    await app.close();
  });
});
