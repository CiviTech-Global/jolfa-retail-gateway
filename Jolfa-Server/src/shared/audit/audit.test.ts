import { afterEach, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { createTestApp } from "../../../test/helpers/build-app.js";
import {
  createTestAdmin,
  createTestCategory,
  createTestUser,
  getAuthToken,
} from "../../../test/helpers/factories.js";
import { prisma } from "../prisma.js";
import { buildChangeMetadata, listAuditLogs, logAudit } from "./audit.service.js";

async function buildTestApp(): Promise<FastifyInstance> {
  return createTestApp();
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("logAudit() — fire-and-forget contract", () => {
  it("writes a row with every field populated", async () => {
    const { user } = await createTestUser();

    await logAudit({
      userId: user.id,
      action: "UPDATE",
      entityType: "Product",
      entityId: "00000000-0000-4000-8000-000000000001",
      metadata: { note: "hello" },
      ipAddress: "127.0.0.1",
      userAgent: "vitest",
    });

    const rows = await prisma.auditLog.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      userId: user.id,
      action: "UPDATE",
      entityType: "Product",
      ipAddress: "127.0.0.1",
      userAgent: "vitest",
    });
    expect(rows[0]?.metadata).toEqual({ note: "hello" });
  });

  it("defaults metadata to an empty object when omitted", async () => {
    const { user } = await createTestUser();

    await logAudit({
      userId: user.id,
      action: "CREATE",
      entityType: "Category",
      entityId: "00000000-0000-4000-8000-000000000002",
    });

    expect((await prisma.auditLog.findFirstOrThrow()).metadata).toEqual({});
  });

  /**
   * The contract that matters: audit logging must never take down the
   * operation it is describing. A failing `auditLog.create` is swallowed.
   */
  /**
   * The failure is provoked naturally rather than by mocking the Prisma
   * client: `AuditLog.entityId` is a `uuid` column, so a non-uuid value makes
   * the insert throw inside `logAudit`. (Spying on a Prisma delegate method
   * and restoring it leaves the shared client broken for later tests, so it is
   * deliberately avoided here.)
   */
  it("swallows a write failure instead of throwing", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await expect(
      logAudit({
        action: "DELETE",
        entityType: "Product",
        entityId: "definitely-not-a-uuid",
      }),
    ).resolves.toBeUndefined();

    expect(consoleSpy).toHaveBeenCalled();
    expect(await prisma.auditLog.count()).toBe(0);
    consoleSpy.mockRestore();
  });

  it("lets the caller's own work continue after an audit write fails", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    // Mirrors the shape of every `*WithAudit` service: do the real work, then
    // log. A throwing logAudit must not prevent or undo the primary write.
    const category = await createTestCategory({ slug: "survives-audit-failure" });
    await logAudit({
      action: "CREATE",
      entityType: "Category",
      entityId: "not-a-uuid-either",
    });

    expect(
      await prisma.category.findUnique({ where: { slug: "survives-audit-failure" } }),
    ).not.toBeNull();
    expect(category.slug).toBe("survives-audit-failure");
    consoleSpy.mockRestore();
  });

  it("accepts a null userId for system-originated actions", async () => {
    await logAudit({
      action: "CREATE",
      entityType: "Setting",
      entityId: "00000000-0000-4000-8000-000000000004",
    });

    expect((await prisma.auditLog.findFirstOrThrow()).userId).toBeNull();
  });
});

describe("buildChangeMetadata()", () => {
  it("wraps before/after snapshots under stable keys", () => {
    const result = buildChangeMetadata({ price: 100 }, { price: 200 });

    expect(result).toEqual({ before: { price: 100 }, after: { price: 200 } });
  });

  it("serialises Date values to ISO strings so the JSON column stays portable", () => {
    const date = new Date("2026-01-02T03:04:05.000Z");

    const result = buildChangeMetadata({ at: date }, { at: date }) as {
      before: { at: string };
    };

    expect(result.before.at).toBe("2026-01-02T03:04:05.000Z");
  });

  it("coerces bigint values to numbers", () => {
    const result = buildChangeMetadata({ total: 10n }, { total: 20n }) as {
      before: { total: number };
      after: { total: number };
    };

    expect(result.before.total).toBe(10);
    expect(result.after.total).toBe(20);
  });

  it("passes through null and undefined without throwing", () => {
    const result = buildChangeMetadata(
      { a: null, b: undefined },
      { a: "set", b: "set" },
    ) as { before: Record<string, unknown> };

    expect(result.before.a).toBeNull();
    expect(result.before.b).toBeUndefined();
  });
});

describe("listAuditLogs()", () => {
  async function seedThree() {
    const { user } = await createTestUser();
    await logAudit({
      userId: user.id,
      action: "CREATE",
      entityType: "Product",
      entityId: "00000000-0000-4000-8000-00000000000a",
    });
    await logAudit({
      userId: user.id,
      action: "DELETE",
      entityType: "Product",
      entityId: "00000000-0000-4000-8000-00000000000b",
    });
    await logAudit({
      action: "UPDATE",
      entityType: "Category",
      entityId: "00000000-0000-4000-8000-00000000000c",
    });
    return user;
  }

  it("returns everything with default paging", async () => {
    await seedThree();

    const result = await listAuditLogs({});

    expect(result.items).toHaveLength(3);
    expect(result.meta).toMatchObject({ page: 1, limit: 20, total: 3, totalPages: 1 });
  });

  it("filters by entityType, action and userId", async () => {
    const user = await seedThree();

    expect((await listAuditLogs({ entityType: "Product" })).items).toHaveLength(2);
    expect((await listAuditLogs({ action: "DELETE" })).items).toHaveLength(1);
    expect((await listAuditLogs({ userId: user.id })).items).toHaveLength(2);
  });

  it("filters by entityId", async () => {
    await seedThree();

    const result = await listAuditLogs({ entityId: "00000000-0000-4000-8000-00000000000a" });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.action).toBe("CREATE");
  });

  it("filters by a from/to date window", async () => {
    await seedThree();

    const future = await listAuditLogs({ from: "2099-01-01T00:00:00.000Z" });
    expect(future.items).toHaveLength(0);

    const past = await listAuditLogs({ from: "2000-01-01T00:00:00.000Z" });
    expect(past.items).toHaveLength(3);
  });

  it("clamps limit to the 1..100 range", async () => {
    await seedThree();

    expect((await listAuditLogs({ limit: 1000 })).meta.limit).toBe(100);
    expect((await listAuditLogs({ limit: 0 })).meta.limit).toBe(1);
    expect((await listAuditLogs({ page: -5 })).meta.page).toBe(1);
  });

  it("returns newest entries first", async () => {
    await seedThree();

    const result = await listAuditLogs({});
    const times = result.items.map((i) => i.createdAt.getTime());

    expect([...times].sort((a, b) => b - a)).toEqual(times);
  });
});

describe("GET /api/v1/admin/audit-logs", () => {
  it("rejects anonymous with 401 and CUSTOMER with 403", async () => {
    const app = await buildTestApp();
    const { user } = await createTestUser();

    const anon = await app.inject({ method: "GET", url: "/api/v1/admin/audit-logs" });
    expect(anon.statusCode).toBe(401);

    const forbidden = await app.inject({
      method: "GET",
      url: "/api/v1/admin/audit-logs",
      headers: { authorization: `Bearer ${getAuthToken(app, user)}` },
    });
    expect(forbidden.statusCode).toBe(403);
    await app.close();
  });

  it("returns audit rows with the acting user joined in", async () => {
    const app = await buildTestApp();
    const { user: admin } = await createTestAdmin();
    const token = getAuthToken(app, admin);
    await createTestCategory({ slug: "unrelated" });

    await app.inject({
      method: "POST",
      url: "/api/v1/categories",
      headers: { authorization: `Bearer ${token}` },
      payload: { name: "برای ممیزی", slug: "for-audit" },
    });

    const res = await app.inject({
      method: "GET",
      url: "/api/v1/admin/audit-logs",
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json().data;
    expect(body.items).toHaveLength(1);
    expect(body.items[0]).toMatchObject({ action: "CREATE", entityType: "Category" });
    expect(body.items[0].user.id).toBe(admin.id);
    await app.close();
  });
});
