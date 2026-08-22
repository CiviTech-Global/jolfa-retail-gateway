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

const BASE = "/api/v1/dashboard";

async function statsFor(app: FastifyInstance, adminId: string, query = "") {
  const admin = await prisma.user.findUniqueOrThrow({ where: { id: adminId } });
  const res = await app.inject({
    method: "GET",
    url: `${BASE}${query}`,
    headers: { authorization: `Bearer ${getAuthToken(app, admin)}` },
  });
  return res;
}

describe("GET /api/v1/dashboard — authorization", () => {
  it("rejects anonymous with 401 and CUSTOMER with 403", async () => {
    const app = await buildTestApp();
    const { user } = await createTestUser();

    expect((await app.inject({ method: "GET", url: BASE })).statusCode).toBe(401);

    const forbidden = await app.inject({
      method: "GET",
      url: BASE,
      headers: { authorization: `Bearer ${getAuthToken(app, user)}` },
    });
    expect(forbidden.statusCode).toBe(403);
    await app.close();
  });
});

describe("GET /api/v1/dashboard — counters", () => {
  it("returns a fully-shaped zero state with no data", async () => {
    const app = await buildTestApp();
    const { user: admin } = await createTestAdmin();

    const res = await statsFor(app, admin.id);

    expect(res.statusCode).toBe(200);
    const stats = res.json().data;
    expect(stats).toMatchObject({
      totalSales: 0,
      totalOrders: 0,
      pendingOrders: 0,
      totalProducts: 0,
      lowStockProducts: 0,
    });
    expect(stats.recentOrders).toEqual([]);
    expect(stats.ordersByStatus).toEqual([]);
    expect(stats.topProducts).toEqual([]);
    expect(stats.recentActivity).toEqual([]);
    await app.close();
  });

  it("counts totalSales from DELIVERED orders only", async () => {
    const app = await buildTestApp();
    const { user } = await createTestUser();
    const { user: admin } = await createTestAdmin();
    const product = await createTestProduct({ price: 100_000 });
    await createTestOrder(user.id, { status: "DELIVERED", items: [{ product, quantity: 1 }] });
    await createTestOrder(user.id, { status: "PENDING", items: [{ product, quantity: 1 }] });
    await createTestOrder(user.id, { status: "CANCELLED", items: [{ product, quantity: 1 }] });

    const stats = (await statsFor(app, admin.id)).json().data;

    expect(stats.totalSales).toBe(100_000);
    expect(stats.totalOrders).toBe(3);
    expect(stats.pendingOrders).toBe(1);
    await app.close();
  });

  it("counts low-stock products as those with stockQuantity < 5", async () => {
    const app = await buildTestApp();
    const { user: admin } = await createTestAdmin();
    const category = (await createTestProduct()).categoryId;
    await createTestProduct({ categoryId: category, stockQuantity: 4 });
    await createTestProduct({ categoryId: category, stockQuantity: 0 });
    await createTestProduct({ categoryId: category, stockQuantity: 5 });

    const stats = (await statsFor(app, admin.id)).json().data;

    // 4 products exist in total (one created for the category).
    expect(stats.totalProducts).toBe(4);
    // stock 4 and 0 are low; stock 5 and the default 10 are not.
    expect(stats.lowStockProducts).toBe(2);
    await app.close();
  });

  it("groups orders by status with correct counts", async () => {
    const app = await buildTestApp();
    const { user } = await createTestUser();
    const { user: admin } = await createTestAdmin();
    await createTestOrder(user.id, { status: "PENDING" });
    await createTestOrder(user.id, { status: "PENDING" });
    await createTestOrder(user.id, { status: "SHIPPED" });

    const stats = (await statsFor(app, admin.id)).json().data;

    const byStatus = Object.fromEntries(
      (stats.ordersByStatus as { status: string; count: number }[]).map((p) => [p.status, p.count]),
    );
    expect(byStatus).toEqual({ PENDING: 2, SHIPPED: 1 });
    await app.close();
  });

  it("ranks top products by total quantity sold", async () => {
    const app = await buildTestApp();
    const { user } = await createTestUser();
    const { user: admin } = await createTestAdmin();
    const popular = await createTestProduct({ title: "پرفروش", stockQuantity: 100 });
    const rare = await createTestProduct({ title: "کم‌فروش", stockQuantity: 100 });
    await createTestOrder(user.id, { items: [{ product: popular, quantity: 7 }] });
    await createTestOrder(user.id, { items: [{ product: rare, quantity: 2 }] });

    const stats = (await statsFor(app, admin.id)).json().data;

    expect(stats.topProducts[0]).toEqual({ title: "پرفروش", sold: 7 });
    expect(stats.topProducts[1]).toEqual({ title: "کم‌فروش", sold: 2 });
    await app.close();
  });

  it("returns at most 5 recent orders, newest first", async () => {
    const app = await buildTestApp();
    const { user } = await createTestUser();
    const { user: admin } = await createTestAdmin();
    for (let i = 0; i < 7; i += 1) {
      await createTestOrder(user.id);
    }

    const stats = (await statsFor(app, admin.id)).json().data;

    expect(stats.recentOrders).toHaveLength(5);
    const timestamps = (stats.recentOrders as { createdAt: string }[]).map((o) =>
      new Date(o.createdAt).getTime(),
    );
    expect([...timestamps].sort((a, b) => b - a)).toEqual(timestamps);
    await app.close();
  });

  it("surfaces recent audit activity", async () => {
    const app = await buildTestApp();
    const { user: admin } = await createTestAdmin();
    const token = getAuthToken(app, admin);
    // Generate a real audit row through a real admin mutation.
    await app.inject({
      method: "POST",
      url: "/api/v1/categories",
      headers: { authorization: `Bearer ${token}` },
      payload: { name: "دسته داشبورد", slug: "dashboard-cat" },
    });

    const stats = (await statsFor(app, admin.id)).json().data;

    expect(stats.recentActivity.length).toBeGreaterThanOrEqual(1);
    expect(stats.recentActivity[0]).toMatchObject({
      action: "CREATE",
      entityType: "Category",
    });
    await app.close();
  });
});

describe("GET /api/v1/dashboard — the days query param", () => {
  it("defaults to a 7-point sales trend", async () => {
    const app = await buildTestApp();
    const { user: admin } = await createTestAdmin();

    const stats = (await statsFor(app, admin.id)).json().data;

    expect(stats.salesTrend).toHaveLength(7);
    await app.close();
  });

  it("honours an explicit in-range days value", async () => {
    const app = await buildTestApp();
    const { user: admin } = await createTestAdmin();

    const stats = (await statsFor(app, admin.id, "?days=30")).json().data;

    expect(stats.salesTrend).toHaveLength(30);
    await app.close();
  });

  it("clamps days above 90 down to 90 rather than erroring", async () => {
    const app = await buildTestApp();
    const { user: admin } = await createTestAdmin();

    const res = await statsFor(app, admin.id, "?days=5000");

    expect(res.statusCode).toBe(200);
    expect(res.json().data.salesTrend).toHaveLength(90);
    await app.close();
  });

  /**
   * Quirk worth pinning: the controller computes
   * `Math.min(90, Math.max(1, Number(days) || 7))`. Because `0` is falsy,
   * `days=0` short-circuits to the DEFAULT of 7 rather than clamping to 1 —
   * unlike `days=-10`, which does clamp to 1 (next test). Harmless, but
   * surprising enough that it should change deliberately, not by accident.
   */
  it("treats days=0 as the default 7, not as a clamp to 1", async () => {
    const app = await buildTestApp();
    const { user: admin } = await createTestAdmin();

    const res = await statsFor(app, admin.id, "?days=0");

    expect(res.statusCode).toBe(200);
    expect(res.json().data.salesTrend).toHaveLength(7);
    await app.close();
  });

  it("falls back to 7 for a non-numeric days value rather than erroring", async () => {
    const app = await buildTestApp();
    const { user: admin } = await createTestAdmin();

    const res = await statsFor(app, admin.id, "?days=abc");

    expect(res.statusCode).toBe(200);
    expect(res.json().data.salesTrend).toHaveLength(7);
    await app.close();
  });

  it("clamps a negative days value up to 1", async () => {
    const app = await buildTestApp();
    const { user: admin } = await createTestAdmin();

    const res = await statsFor(app, admin.id, "?days=-10");

    expect(res.statusCode).toBe(200);
    expect(res.json().data.salesTrend).toHaveLength(1);
    await app.close();
  });

  it("returns trend points as YYYY-MM-DD ending today, ascending", async () => {
    const app = await buildTestApp();
    const { user: admin } = await createTestAdmin();

    const stats = (await statsFor(app, admin.id, "?days=3")).json().data;
    const dates = (stats.salesTrend as { date: string }[]).map((p) => p.date);

    expect(dates).toHaveLength(3);
    for (const date of dates) {
      expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
    expect([...dates].sort()).toEqual(dates);
    expect(dates[2]).toBe(new Date().toISOString().split("T")[0]);
    await app.close();
  });

  it("attributes a DELIVERED order placed today to today's trend point", async () => {
    const app = await buildTestApp();
    const { user } = await createTestUser();
    const { user: admin } = await createTestAdmin();
    const product = await createTestProduct({ price: 55_000 });
    await createTestOrder(user.id, { status: "DELIVERED", items: [{ product, quantity: 1 }] });

    const stats = (await statsFor(app, admin.id, "?days=3")).json().data;
    const trend = stats.salesTrend as { date: string; sales: number }[];

    expect(trend[2]?.sales).toBe(55_000);
    expect(trend[0]?.sales).toBe(0);
    await app.close();
  });
});
