import { describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { createTestApp } from "../../../test/helpers/build-app.js";
import {
  createTestAdmin,
  createTestUser,
  getAuthToken,
} from "../../../test/helpers/factories.js";
import { prisma } from "../../shared/prisma.js";

async function buildTestApp(): Promise<FastifyInstance> {
  return createTestApp();
}

const USERS = "/api/v1/admin/users";

describe("GET /api/v1/admin/users", () => {
  it("rejects anonymous with 401 and CUSTOMER with 403", async () => {
    const app = await buildTestApp();
    const { user } = await createTestUser();

    expect((await app.inject({ method: "GET", url: USERS })).statusCode).toBe(401);

    const forbidden = await app.inject({
      method: "GET",
      url: USERS,
      headers: { authorization: `Bearer ${getAuthToken(app, user)}` },
    });
    expect(forbidden.statusCode).toBe(403);
    await app.close();
  });

  it("lists users with pagination meta and never leaks password hashes", async () => {
    const app = await buildTestApp();
    const { user: admin } = await createTestAdmin();
    await createTestUser();
    await createTestUser();

    const res = await app.inject({
      method: "GET",
      url: USERS,
      headers: { authorization: `Bearer ${getAuthToken(app, admin)}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json().data;
    expect(body.meta).toMatchObject({ page: 1, limit: 20, total: 3 });
    expect(body.users[0]).not.toHaveProperty("passwordHash");
    expect(res.body).not.toContain("passwordHash");
    await app.close();
  });

  it("filters by role", async () => {
    const app = await buildTestApp();
    const { user: admin } = await createTestAdmin();
    await createTestUser();

    const res = await app.inject({
      method: "GET",
      url: `${USERS}?role=ADMIN`,
      headers: { authorization: `Bearer ${getAuthToken(app, admin)}` },
    });

    const users = res.json().data.users as { id: string; role: string }[];
    expect(users).toHaveLength(1);
    expect(users[0]).toMatchObject({ id: admin.id, role: "ADMIN" });
    await app.close();
  });

  it("filters by isActive", async () => {
    const app = await buildTestApp();
    const { user: admin } = await createTestAdmin();
    const { user: inactive } = await createTestUser({ isActive: false });
    await createTestUser({ isActive: true });

    const res = await app.inject({
      method: "GET",
      url: `${USERS}?isActive=false`,
      headers: { authorization: `Bearer ${getAuthToken(app, admin)}` },
    });

    const users = res.json().data.users as { id: string }[];
    expect(users).toHaveLength(1);
    expect(users[0]?.id).toBe(inactive.id);
    await app.close();
  });

  it("searches across phone, email, firstName and lastName via q", async () => {
    const app = await buildTestApp();
    const { user: admin } = await createTestAdmin();
    const token = getAuthToken(app, admin);
    const { user: target } = await createTestUser({
      email: "sara@example.com",
      firstName: "سارا",
      lastName: "محمدی",
    });
    await createTestUser({ firstName: "دیگری" });

    for (const q of ["sara@example.com", "سارا", "محمدی", target.phone]) {
      const res = await app.inject({
        method: "GET",
        url: `${USERS}?q=${encodeURIComponent(q)}`,
        headers: { authorization: `Bearer ${token}` },
      });
      const ids = (res.json().data.users as { id: string }[]).map((u) => u.id);
      expect(ids).toContain(target.id);
    }
    await app.close();
  });

  it("rejects an unrecognised role filter with 422", async () => {
    const app = await buildTestApp();
    const { user: admin } = await createTestAdmin();

    const res = await app.inject({
      method: "GET",
      url: `${USERS}?role=SUPERUSER`,
      headers: { authorization: `Bearer ${getAuthToken(app, admin)}` },
    });

    expect(res.statusCode).toBe(422);
    await app.close();
  });
});

describe("PATCH /api/v1/admin/users/:id/role", () => {
  it("promotes a CUSTOMER to ADMIN and writes an audit row", async () => {
    const app = await buildTestApp();
    const { user: admin } = await createTestAdmin();
    const { user: target } = await createTestUser();

    const res = await app.inject({
      method: "PATCH",
      url: `${USERS}/${target.id}/role`,
      headers: { authorization: `Bearer ${getAuthToken(app, admin)}` },
      payload: { role: "ADMIN" },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().data.user.role).toBe("ADMIN");
    expect((await prisma.user.findUnique({ where: { id: target.id } }))?.role).toBe("ADMIN");

    const audits = await prisma.auditLog.findMany({ where: { entityType: "User" } });
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({ entityId: target.id, userId: admin.id });
    await app.close();
  });

  it("demotes an ADMIN back to CUSTOMER", async () => {
    const app = await buildTestApp();
    const { user: admin } = await createTestAdmin();
    const { user: target } = await createTestAdmin();

    const res = await app.inject({
      method: "PATCH",
      url: `${USERS}/${target.id}/role`,
      headers: { authorization: `Bearer ${getAuthToken(app, admin)}` },
      payload: { role: "CUSTOMER" },
    });

    expect(res.statusCode).toBe(200);
    expect((await prisma.user.findUnique({ where: { id: target.id } }))?.role).toBe("CUSTOMER");
    await app.close();
  });

  /**
   * A role change only reaches the client on the NEXT token issue: the JWT
   * carries the role claim, so an already-issued token keeps its old role
   * until it is re-minted. Pinned because it determines whether a demotion
   * takes effect immediately.
   */
  it("reflects the new role in a freshly-minted token, not in the old one", async () => {
    const app = await buildTestApp();
    const { user: admin } = await createTestAdmin();
    const { user: target } = await createTestUser();
    const staleToken = getAuthToken(app, target);

    await app.inject({
      method: "PATCH",
      url: `${USERS}/${target.id}/role`,
      headers: { authorization: `Bearer ${getAuthToken(app, admin)}` },
      payload: { role: "ADMIN" },
    });

    // The stale CUSTOMER token is still refused by the admin guard...
    const withStale = await app.inject({
      method: "GET",
      url: USERS,
      headers: { authorization: `Bearer ${staleToken}` },
    });
    expect(withStale.statusCode).toBe(403);

    // ...while a token minted after the change carries role=ADMIN.
    const refreshed = await prisma.user.findUniqueOrThrow({ where: { id: target.id } });
    const withFresh = await app.inject({
      method: "GET",
      url: USERS,
      headers: { authorization: `Bearer ${getAuthToken(app, refreshed)}` },
    });
    expect(withFresh.statusCode).toBe(200);
    await app.close();
  });

  /**
   * KNOWN GAP (docs/testing/10-known-gaps.md §3): there is no self-lockout
   * guard. An admin may demote themselves, potentially removing the last
   * admin with no in-app recovery path. Pins CURRENT behaviour.
   */
  it("currently ALLOWS an admin to demote themselves (no self-lockout guard)", async () => {
    const app = await buildTestApp();
    const { user: admin } = await createTestAdmin();

    const res = await app.inject({
      method: "PATCH",
      url: `${USERS}/${admin.id}/role`,
      headers: { authorization: `Bearer ${getAuthToken(app, admin)}` },
      payload: { role: "CUSTOMER" },
    });

    expect(res.statusCode).toBe(200);
    expect((await prisma.user.findUnique({ where: { id: admin.id } }))?.role).toBe("CUSTOMER");
    await app.close();
  });

  it("returns 404 for an unknown user and 422 for an invalid role", async () => {
    const app = await buildTestApp();
    const { user: admin } = await createTestAdmin();
    const token = getAuthToken(app, admin);

    const missing = await app.inject({
      method: "PATCH",
      url: `${USERS}/00000000-0000-4000-8000-000000000000/role`,
      headers: { authorization: `Bearer ${token}` },
      payload: { role: "ADMIN" },
    });
    expect(missing.statusCode).toBe(404);

    const { user: target } = await createTestUser();
    const invalid = await app.inject({
      method: "PATCH",
      url: `${USERS}/${target.id}/role`,
      headers: { authorization: `Bearer ${token}` },
      payload: { role: "WIZARD" },
    });
    expect(invalid.statusCode).toBe(422);
    await app.close();
  });

  it("rejects a CUSTOMER attempting a role change with 403", async () => {
    const app = await buildTestApp();
    const { user } = await createTestUser();
    const { user: target } = await createTestUser();

    const res = await app.inject({
      method: "PATCH",
      url: `${USERS}/${target.id}/role`,
      headers: { authorization: `Bearer ${getAuthToken(app, user)}` },
      payload: { role: "ADMIN" },
    });

    expect(res.statusCode).toBe(403);
    await app.close();
  });
});

describe("PATCH /api/v1/admin/users/:id/status", () => {
  it("deactivates a user and writes an audit row", async () => {
    const app = await buildTestApp();
    const { user: admin } = await createTestAdmin();
    const { user: target } = await createTestUser();

    const res = await app.inject({
      method: "PATCH",
      url: `${USERS}/${target.id}/status`,
      headers: { authorization: `Bearer ${getAuthToken(app, admin)}` },
      payload: { isActive: false },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().data.user.isActive).toBe(false);
    expect(await prisma.auditLog.count({ where: { entityType: "User" } })).toBe(1);
    await app.close();
  });

  it("blocks a deactivated user from logging in again", async () => {
    const app = await buildTestApp();
    const { user: admin } = await createTestAdmin();
    const { user: target, password } = await createTestUser();

    await app.inject({
      method: "PATCH",
      url: `${USERS}/${target.id}/status`,
      headers: { authorization: `Bearer ${getAuthToken(app, admin)}` },
      payload: { isActive: false },
    });

    const login = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { identifier: target.phone, password },
    });

    expect(login.statusCode).toBeGreaterThanOrEqual(400);
    await app.close();
  });

  /**
   * KNOWN GAP — pins CURRENT behaviour. `authenticate` only verifies the JWT
   * signature; it never re-checks `isActive` against the database. So a user
   * deactivated mid-session keeps full access with their EXISTING token until
   * it expires (up to JWT_ACCESS_EXPIRES_IN, currently 24h). Deactivation is
   * therefore NOT immediate. Flip this test if a DB freshness check is added.
   */
  it("does NOT immediately invalidate an already-issued token on deactivation", async () => {
    const app = await buildTestApp();
    const { user: admin } = await createTestAdmin();
    const { user: target } = await createTestUser();
    const existingToken = getAuthToken(app, target);

    await app.inject({
      method: "PATCH",
      url: `${USERS}/${target.id}/status`,
      headers: { authorization: `Bearer ${getAuthToken(app, admin)}` },
      payload: { isActive: false },
    });

    const res = await app.inject({
      method: "GET",
      url: "/api/v1/auth/me",
      headers: { authorization: `Bearer ${existingToken}` },
    });

    expect(res.statusCode).toBe(200);
    await app.close();
  });

  it("reactivates a previously deactivated user", async () => {
    const app = await buildTestApp();
    const { user: admin } = await createTestAdmin();
    const token = getAuthToken(app, admin);
    const { user: target } = await createTestUser({ isActive: false });

    const res = await app.inject({
      method: "PATCH",
      url: `${USERS}/${target.id}/status`,
      headers: { authorization: `Bearer ${token}` },
      payload: { isActive: true },
    });

    expect(res.statusCode).toBe(200);
    expect((await prisma.user.findUnique({ where: { id: target.id } }))?.isActive).toBe(true);
    await app.close();
  });

  /** KNOWN GAP §3, status half: self-deactivation is likewise unguarded. */
  it("currently ALLOWS an admin to deactivate their own account", async () => {
    const app = await buildTestApp();
    const { user: admin } = await createTestAdmin();

    const res = await app.inject({
      method: "PATCH",
      url: `${USERS}/${admin.id}/status`,
      headers: { authorization: `Bearer ${getAuthToken(app, admin)}` },
      payload: { isActive: false },
    });

    expect(res.statusCode).toBe(200);
    expect((await prisma.user.findUnique({ where: { id: admin.id } }))?.isActive).toBe(false);
    await app.close();
  });

  it("returns 404 for an unknown user and 422 for a non-boolean isActive", async () => {
    const app = await buildTestApp();
    const { user: admin } = await createTestAdmin();
    const token = getAuthToken(app, admin);

    const missing = await app.inject({
      method: "PATCH",
      url: `${USERS}/00000000-0000-4000-8000-000000000000/status`,
      headers: { authorization: `Bearer ${token}` },
      payload: { isActive: false },
    });
    expect(missing.statusCode).toBe(404);

    const { user: target } = await createTestUser();
    const invalid = await app.inject({
      method: "PATCH",
      url: `${USERS}/${target.id}/status`,
      headers: { authorization: `Bearer ${token}` },
      payload: { isActive: "no" },
    });
    expect(invalid.statusCode).toBe(422);
    await app.close();
  });
});
