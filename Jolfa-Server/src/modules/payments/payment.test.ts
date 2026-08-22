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

const BASE = "/api/v1/payments";

/** Drives a full request->verify cycle and returns the resulting authority. */
async function payForOrder(app: FastifyInstance, token: string, orderId: string): Promise<string> {
  const res = await app.inject({
    method: "POST",
    url: `${BASE}/request`,
    headers: { authorization: `Bearer ${token}` },
    payload: { orderId },
  });
  return res.json().data.authority as string;
}

describe("POST /api/v1/payments/request", () => {
  it("creates a Payment plus a PENDING transaction and returns a gateway URL", async () => {
    const app = await buildTestApp();
    const { user } = await createTestUser();
    const token = getAuthToken(app, user);
    const order = await createTestOrder(user.id, { shippingCost: 80_000 });

    const res = await app.inject({
      method: "POST",
      url: `${BASE}/request`,
      headers: { authorization: `Bearer ${token}` },
      payload: { orderId: order.id },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json().data;
    expect(body.authority).toMatch(/^auth-/);
    expect(body.paymentUrl).toContain(body.authority);

    const payment = await prisma.payment.findUnique({ where: { orderId: order.id } });
    expect(payment).toMatchObject({ status: "PENDING", amount: order.finalAmount });

    const transactions = await prisma.transaction.findMany({ where: { orderId: order.id } });
    expect(transactions).toHaveLength(1);
    expect(transactions[0]).toMatchObject({ type: "PAYMENT", status: "PENDING" });
    await app.close();
  });

  it("reuses the existing authority when a PENDING payment already exists", async () => {
    const app = await buildTestApp();
    const { user } = await createTestUser();
    const token = getAuthToken(app, user);
    const order = await createTestOrder(user.id);

    const first = await payForOrder(app, token, order.id);
    const second = await payForOrder(app, token, order.id);

    expect(second).toBe(first);
    // No duplicate Payment row and no second PENDING transaction.
    expect(await prisma.payment.count({ where: { orderId: order.id } })).toBe(1);
    expect(await prisma.transaction.count({ where: { orderId: order.id } })).toBe(1);
    await app.close();
  });

  it("rejects paying for another user's order with 400", async () => {
    const app = await buildTestApp();
    const { user: owner } = await createTestUser();
    const { user: attacker } = await createTestUser();
    const order = await createTestOrder(owner.id);

    const res = await app.inject({
      method: "POST",
      url: `${BASE}/request`,
      headers: { authorization: `Bearer ${getAuthToken(app, attacker)}` },
      payload: { orderId: order.id },
    });

    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it("rejects an order that is already paid with 409", async () => {
    const app = await buildTestApp();
    const { user } = await createTestUser();
    const order = await createTestOrder(user.id, {
      status: "PROCESSING",
      paymentStatus: "COMPLETED",
    });

    const res = await app.inject({
      method: "POST",
      url: `${BASE}/request`,
      headers: { authorization: `Bearer ${getAuthToken(app, user)}` },
      payload: { orderId: order.id },
    });

    expect(res.statusCode).toBe(409);
    await app.close();
  });

  it("returns 404 for an unknown order id", async () => {
    const app = await buildTestApp();
    const { user } = await createTestUser();

    const res = await app.inject({
      method: "POST",
      url: `${BASE}/request`,
      headers: { authorization: `Bearer ${getAuthToken(app, user)}` },
      payload: { orderId: "00000000-0000-4000-8000-000000000000" },
    });

    expect(res.statusCode).toBe(404);
    await app.close();
  });

  it("rejects an unauthenticated request with 401", async () => {
    const app = await buildTestApp();

    const res = await app.inject({
      method: "POST",
      url: `${BASE}/request`,
      payload: { orderId: "00000000-0000-4000-8000-000000000000" },
    });

    expect(res.statusCode).toBe(401);
    await app.close();
  });
});

describe("POST /api/v1/payments/verify", () => {
  it("marks payment COMPLETED and advances the order on Status=OK", async () => {
    const app = await buildTestApp();
    const { user } = await createTestUser();
    const token = getAuthToken(app, user);
    const order = await createTestOrder(user.id);
    const authority = await payForOrder(app, token, order.id);

    const res = await app.inject({
      method: "POST",
      url: `${BASE}/verify`,
      payload: { authority, status: "OK" },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().data.success).toBe(true);
    expect(res.json().data.refId).toMatch(/^ref-/);

    const payment = await prisma.payment.findUnique({ where: { orderId: order.id } });
    expect(payment?.status).toBe("COMPLETED");
    expect(payment?.paidAt).not.toBeNull();

    const updatedOrder = await prisma.order.findUnique({ where: { id: order.id } });
    expect(updatedOrder).toMatchObject({ paymentStatus: "COMPLETED", status: "PROCESSING" });

    const completed = await prisma.transaction.findMany({
      where: { orderId: order.id, status: "COMPLETED" },
    });
    expect(completed).toHaveLength(1);
    await app.close();
  });

  it("marks payment FAILED and leaves the order untouched on Status=NOK", async () => {
    const app = await buildTestApp();
    const { user } = await createTestUser();
    const token = getAuthToken(app, user);
    const order = await createTestOrder(user.id);
    const authority = await payForOrder(app, token, order.id);

    const res = await app.inject({
      method: "POST",
      url: `${BASE}/verify`,
      payload: { authority, status: "NOK" },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().data.success).toBe(false);

    const payment = await prisma.payment.findUnique({ where: { orderId: order.id } });
    expect(payment?.status).toBe("FAILED");

    const updatedOrder = await prisma.order.findUnique({ where: { id: order.id } });
    expect(updatedOrder).toMatchObject({ paymentStatus: "PENDING", status: "PENDING" });

    const failed = await prisma.transaction.findMany({
      where: { orderId: order.id, status: "FAILED" },
    });
    expect(failed).toHaveLength(1);
    await app.close();
  });

  it("is idempotent: verifying an already-COMPLETED payment does not double-charge", async () => {
    const app = await buildTestApp();
    const { user } = await createTestUser();
    const token = getAuthToken(app, user);
    const order = await createTestOrder(user.id);
    const authority = await payForOrder(app, token, order.id);

    await app.inject({ method: "POST", url: `${BASE}/verify`, payload: { authority, status: "OK" } });
    const second = await app.inject({
      method: "POST",
      url: `${BASE}/verify`,
      payload: { authority, status: "OK" },
    });

    expect(second.statusCode).toBe(200);
    expect(second.json().data.success).toBe(true);
    const completed = await prisma.transaction.count({
      where: { orderId: order.id, status: "COMPLETED" },
    });
    expect(completed).toBe(1);
    await app.close();
  });

  it("returns a clean 404 for an unknown authority rather than crashing", async () => {
    const app = await buildTestApp();

    const res = await app.inject({
      method: "POST",
      url: `${BASE}/verify`,
      payload: { authority: "auth-does-not-exist", status: "OK" },
    });

    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe("NOT_FOUND");
    await app.close();
  });

  it("rejects an empty authority with 422", async () => {
    const app = await buildTestApp();

    const res = await app.inject({
      method: "POST",
      url: `${BASE}/verify`,
      payload: { authority: "", status: "OK" },
    });

    expect(res.statusCode).toBe(422);
    await app.close();
  });

  // The gateway calls this endpoint directly, so it must stay unauthenticated.
  it("does not require authentication (it is the gateway callback)", async () => {
    const app = await buildTestApp();
    const { user } = await createTestUser();
    const token = getAuthToken(app, user);
    const order = await createTestOrder(user.id);
    const authority = await payForOrder(app, token, order.id);

    const res = await app.inject({
      method: "POST",
      url: `${BASE}/verify`,
      payload: { authority, status: "OK" },
    });

    expect(res.statusCode).not.toBe(401);
    await app.close();
  });
});

describe("GET /api/v1/payments/:authority — ownership scoping", () => {
  it("lets the owner read their own payment", async () => {
    const app = await buildTestApp();
    const { user } = await createTestUser();
    const token = getAuthToken(app, user);
    const order = await createTestOrder(user.id);
    const authority = await payForOrder(app, token, order.id);

    const res = await app.inject({
      method: "GET",
      url: `${BASE}/${authority}`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().data.payment.order.id).toBe(order.id);
    await app.close();
  });

  /**
   * Regression test for the IDOR in docs/testing/10-known-gaps.md §1.
   * User B must not be able to read User A's payment by its authority.
   */
  it("refuses a different user's payment (IDOR regression, gap §1)", async () => {
    const app = await buildTestApp();
    const { user: owner } = await createTestUser();
    const { user: attacker } = await createTestUser();
    const order = await createTestOrder(owner.id);
    const authority = await payForOrder(app, getAuthToken(app, owner), order.id);

    const res = await app.inject({
      method: "GET",
      url: `${BASE}/${authority}`,
      headers: { authorization: `Bearer ${getAuthToken(app, attacker)}` },
    });

    expect(res.statusCode).toBe(404);
    expect(res.body).not.toContain(order.orderNumber);
    await app.close();
  });

  it("still allows an ADMIN to read any payment", async () => {
    const app = await buildTestApp();
    const { user: owner } = await createTestUser();
    const { user: admin } = await createTestAdmin();
    const order = await createTestOrder(owner.id);
    const authority = await payForOrder(app, getAuthToken(app, owner), order.id);

    const res = await app.inject({
      method: "GET",
      url: `${BASE}/${authority}`,
      headers: { authorization: `Bearer ${getAuthToken(app, admin)}` },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().data.payment.order.id).toBe(order.id);
    await app.close();
  });

  it("returns 404 for an unknown authority and 401 when unauthenticated", async () => {
    const app = await buildTestApp();
    const { user } = await createTestUser();

    const missing = await app.inject({
      method: "GET",
      url: `${BASE}/auth-nonexistent`,
      headers: { authorization: `Bearer ${getAuthToken(app, user)}` },
    });
    expect(missing.statusCode).toBe(404);

    const anon = await app.inject({ method: "GET", url: `${BASE}/auth-nonexistent` });
    expect(anon.statusCode).toBe(401);
    await app.close();
  });
});

describe("GET /api/v1/admin/payments and /admin/transactions", () => {
  it("rejects non-admins with 403 and anonymous with 401", async () => {
    const app = await buildTestApp();
    const { user } = await createTestUser();

    for (const url of ["/api/v1/admin/payments", "/api/v1/admin/transactions"]) {
      expect((await app.inject({ method: "GET", url })).statusCode).toBe(401);
      const forbidden = await app.inject({
        method: "GET",
        url,
        headers: { authorization: `Bearer ${getAuthToken(app, user)}` },
      });
      expect(forbidden.statusCode).toBe(403);
    }
    await app.close();
  });

  it("lists payments for an admin and filters by status", async () => {
    const app = await buildTestApp();
    const { user } = await createTestUser();
    const { user: admin } = await createTestAdmin();
    const token = getAuthToken(app, user);
    const paidOrder = await createTestOrder(user.id);
    const pendingOrder = await createTestOrder(user.id);
    const authority = await payForOrder(app, token, paidOrder.id);
    await payForOrder(app, token, pendingOrder.id);
    await app.inject({ method: "POST", url: `${BASE}/verify`, payload: { authority, status: "OK" } });

    const all = await app.inject({
      method: "GET",
      url: "/api/v1/admin/payments",
      headers: { authorization: `Bearer ${getAuthToken(app, admin)}` },
    });
    expect(all.json().data.meta.total).toBe(2);

    const completed = await app.inject({
      method: "GET",
      url: "/api/v1/admin/payments?status=COMPLETED",
      headers: { authorization: `Bearer ${getAuthToken(app, admin)}` },
    });
    expect(completed.json().data.payments).toHaveLength(1);
    expect(completed.json().data.payments[0].order.id).toBe(paidOrder.id);
    await app.close();
  });

  it("filters transactions by orderId, type and status", async () => {
    const app = await buildTestApp();
    const { user } = await createTestUser();
    const { user: admin } = await createTestAdmin();
    const adminToken = getAuthToken(app, admin);
    const token = getAuthToken(app, user);
    const orderA = await createTestOrder(user.id);
    const orderB = await createTestOrder(user.id);
    const authority = await payForOrder(app, token, orderA.id);
    await payForOrder(app, token, orderB.id);
    await app.inject({ method: "POST", url: `${BASE}/verify`, payload: { authority, status: "OK" } });

    const byOrder = await app.inject({
      method: "GET",
      url: `/api/v1/admin/transactions?orderId=${orderA.id}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(
      byOrder.json().data.transactions.every((t: { orderId: string }) => t.orderId === orderA.id),
    ).toBe(true);

    const byStatus = await app.inject({
      method: "GET",
      url: "/api/v1/admin/transactions?status=COMPLETED",
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(byStatus.json().data.transactions).toHaveLength(1);

    const byType = await app.inject({
      method: "GET",
      url: "/api/v1/admin/transactions?type=REFUND",
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(byType.json().data.transactions).toHaveLength(0);
    await app.close();
  });

  it("rejects an unrecognised transaction status filter with 422", async () => {
    const app = await buildTestApp();
    const { user: admin } = await createTestAdmin();

    const res = await app.inject({
      method: "GET",
      url: "/api/v1/admin/transactions?status=BOGUS",
      headers: { authorization: `Bearer ${getAuthToken(app, admin)}` },
    });

    expect(res.statusCode).toBe(422);
    await app.close();
  });
});

describe("POST /api/v1/admin/orders/:id/refund", () => {
  /** Creates a fully paid order and returns it. */
  async function paidOrder(app: FastifyInstance, userId: string, token: string, price: number) {
    const product = await createTestProduct({ price });
    const order = await createTestOrder(userId, { items: [{ product, quantity: 1 }] });
    const authority = await payForOrder(app, token, order.id);
    await app.inject({ method: "POST", url: `${BASE}/verify`, payload: { authority, status: "OK" } });
    return order;
  }

  it("keeps paymentStatus COMPLETED after a partial refund", async () => {
    const app = await buildTestApp();
    const { user } = await createTestUser();
    const { user: admin } = await createTestAdmin();
    const order = await paidOrder(app, user.id, getAuthToken(app, user), 100_000);

    const res = await app.inject({
      method: "POST",
      url: `/api/v1/admin/orders/${order.id}/refund`,
      headers: { authorization: `Bearer ${getAuthToken(app, admin)}` },
      payload: { amount: 40_000 },
    });

    expect(res.statusCode).toBe(201);
    expect(res.json().data.transaction).toMatchObject({
      type: "REFUND",
      amount: 40_000,
      status: "COMPLETED",
    });
    const updated = await prisma.order.findUnique({ where: { id: order.id } });
    expect(updated?.paymentStatus).toBe("COMPLETED");
    await app.close();
  });

  it("flips paymentStatus to REFUNDED once the full amount is refunded", async () => {
    const app = await buildTestApp();
    const { user } = await createTestUser();
    const { user: admin } = await createTestAdmin();
    const adminToken = getAuthToken(app, admin);
    const order = await paidOrder(app, user.id, getAuthToken(app, user), 100_000);

    await app.inject({
      method: "POST",
      url: `/api/v1/admin/orders/${order.id}/refund`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { amount: 60_000 },
    });
    await app.inject({
      method: "POST",
      url: `/api/v1/admin/orders/${order.id}/refund`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { amount: 40_000 },
    });

    const updated = await prisma.order.findUnique({ where: { id: order.id } });
    expect(updated?.paymentStatus).toBe("REFUNDED");
    await app.close();
  });

  it("rejects refunding more than was paid with 400", async () => {
    const app = await buildTestApp();
    const { user } = await createTestUser();
    const { user: admin } = await createTestAdmin();
    const order = await paidOrder(app, user.id, getAuthToken(app, user), 100_000);

    const res = await app.inject({
      method: "POST",
      url: `/api/v1/admin/orders/${order.id}/refund`,
      headers: { authorization: `Bearer ${getAuthToken(app, admin)}` },
      payload: { amount: 100_001 },
    });

    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it("rejects any refund on an unpaid order", async () => {
    const app = await buildTestApp();
    const { user } = await createTestUser();
    const { user: admin } = await createTestAdmin();
    const order = await createTestOrder(user.id);

    const res = await app.inject({
      method: "POST",
      url: `/api/v1/admin/orders/${order.id}/refund`,
      headers: { authorization: `Bearer ${getAuthToken(app, admin)}` },
      payload: { amount: 1 },
    });

    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it("returns 404 for an unknown order", async () => {
    const app = await buildTestApp();
    const { user: admin } = await createTestAdmin();

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/admin/orders/00000000-0000-4000-8000-000000000000/refund",
      headers: { authorization: `Bearer ${getAuthToken(app, admin)}` },
      payload: { amount: 1 },
    });

    expect(res.statusCode).toBe(404);
    await app.close();
  });

  it("writes a REFUND audit row attributed to the acting admin", async () => {
    const app = await buildTestApp();
    const { user } = await createTestUser();
    const { user: admin } = await createTestAdmin();
    const order = await paidOrder(app, user.id, getAuthToken(app, user), 50_000);

    await app.inject({
      method: "POST",
      url: `/api/v1/admin/orders/${order.id}/refund`,
      headers: { authorization: `Bearer ${getAuthToken(app, admin)}` },
      payload: { amount: 50_000 },
    });

    const audits = await prisma.auditLog.findMany({ where: { action: "REFUND" } });
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({ entityType: "Transaction", userId: admin.id });
    await app.close();
  });

  it("rejects a non-admin with 403 and a non-positive amount with 422", async () => {
    const app = await buildTestApp();
    const { user } = await createTestUser();
    const { user: admin } = await createTestAdmin();
    const order = await createTestOrder(user.id);

    const forbidden = await app.inject({
      method: "POST",
      url: `/api/v1/admin/orders/${order.id}/refund`,
      headers: { authorization: `Bearer ${getAuthToken(app, user)}` },
      payload: { amount: 1000 },
    });
    expect(forbidden.statusCode).toBe(403);

    const invalid = await app.inject({
      method: "POST",
      url: `/api/v1/admin/orders/${order.id}/refund`,
      headers: { authorization: `Bearer ${getAuthToken(app, admin)}` },
      payload: { amount: 0 },
    });
    expect(invalid.statusCode).toBe(422);
    await app.close();
  });
});
