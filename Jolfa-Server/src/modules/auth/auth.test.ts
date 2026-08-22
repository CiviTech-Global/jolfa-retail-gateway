import { describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { createTestApp } from "../../../test/helpers/build-app.js";
import { createTestUser, getAuthToken } from "../../../test/helpers/factories.js";

async function buildTestApp(): Promise<FastifyInstance> {
  return createTestApp();
}

describe("POST /api/v1/auth/register", () => {
  it("succeeds with only phone and password (AU-001)", async () => {
    const app = await buildTestApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: { phone: "09121234567", password: "secret123" },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.user.phone).toBe("09121234567");
    expect(body.data.tokens.accessToken).toBeTypeOf("string");
    expect(body.data.tokens.refreshToken).toBeTypeOf("string");
    await app.close();
  });

  it("succeeds with all optional fields populated (AU-002)", async () => {
    const app = await buildTestApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: {
        phone: "09121234568",
        password: "secret123",
        email: "test@example.com",
        firstName: "علی",
        lastName: "رضایی",
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.data.user.email).toBe("test@example.com");
    expect(body.data.user.firstName).toBe("علی");
    expect(body.data.user.lastName).toBe("رضایی");
    await app.close();
  });

  it("rejects phone shorter than 10 chars with 400 (AU-004)", async () => {
    const app = await buildTestApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: { phone: "0912", password: "secret123" },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe("VALIDATION_ERROR");
    await app.close();
  });

  it("rejects password shorter than 6 chars with 400 (AU-006)", async () => {
    const app = await buildTestApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: { phone: "09121234569", password: "123" },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe("VALIDATION_ERROR");
    await app.close();
  });

  it("rejects a malformed email (AU-007a)", async () => {
    const app = await buildTestApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: { phone: "09121234570", password: "secret123", email: "not-an-email" },
    });

    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it("accepts a request with email omitted (AU-007b)", async () => {
    const app = await buildTestApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: { phone: "09121234571", password: "secret123" },
    });

    expect(res.statusCode).toBe(201);
    expect(res.json().data.user.email).toBeNull();
    await app.close();
  });

  it("rejects a phone number that is already registered (AU-008)", async () => {
    const app = await buildTestApp();
    await createTestUser({ phone: "09121234572" });

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: { phone: "09121234572", password: "secret123" },
    });

    expect(res.statusCode).toBe(409);
    expect(res.json().success).toBe(false);
    await app.close();
  });
});

describe("POST /api/v1/auth/login", () => {
  it("succeeds with phone + correct password (AU-012)", async () => {
    const app = await buildTestApp();
    const { user, password } = await createTestUser({ phone: "09121234573" });

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { phone: user.phone, password },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().data.user.id).toBe(user.id);
    await app.close();
  });

  it("succeeds with email + correct password (AU-013)", async () => {
    const app = await buildTestApp();
    const { password } = await createTestUser({
      phone: "09121234574",
      email: "login-test@example.com",
    });

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email: "login-test@example.com", password },
    });

    expect(res.statusCode).toBe(200);
    await app.close();
  });

  it("rejects an incorrect password with 401 (AU-014)", async () => {
    const app = await buildTestApp();
    const { user } = await createTestUser({ phone: "09121234575" });

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { phone: user.phone, password: "wrong-password" },
    });

    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it("rejects a non-existent phone/email with 401, not a crash (AU-015)", async () => {
    const app = await buildTestApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { phone: "09129999999", password: "whatever1" },
    });

    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it("rejects login for a deactivated account", async () => {
    const app = await buildTestApp();
    const { user, password } = await createTestUser({
      phone: "09121234576",
      isActive: false,
    });

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { phone: user.phone, password },
    });

    expect(res.statusCode).toBe(401);
    await app.close();
  });
});

describe("GET /api/v1/auth/me", () => {
  it("returns the current user's profile with a valid token", async () => {
    const app = await buildTestApp();
    const { user } = await createTestUser({ phone: "09121234577" });
    const token = getAuthToken(app, user);

    const res = await app.inject({
      method: "GET",
      url: "/api/v1/auth/me",
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().data.user.id).toBe(user.id);
    await app.close();
  });

  it("rejects with 401 when no token is provided (AU-030)", async () => {
    const app = await buildTestApp();
    const res = await app.inject({ method: "GET", url: "/api/v1/auth/me" });

    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it("rejects with 401 for a malformed/invalid token", async () => {
    const app = await buildTestApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/auth/me",
      headers: { authorization: "Bearer not-a-real-token" },
    });

    expect(res.statusCode).toBe(401);
    await app.close();
  });
});

describe("role guard: authorize() (AU-029)", () => {
  it("rejects a CUSTOMER token with 403 on an admin-only route", async () => {
    const app = await buildTestApp();
    const { user } = await createTestUser({ phone: "09121234578", role: "CUSTOMER" });
    const token = getAuthToken(app, user);

    const res = await app.inject({
      method: "GET",
      url: "/api/v1/admin/orders",
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(403);
    await app.close();
  });

  it("allows an ADMIN token on an admin-only route", async () => {
    const app = await buildTestApp();
    const { user } = await createTestUser({ phone: "09121234579", role: "ADMIN" });
    const token = getAuthToken(app, user);

    const res = await app.inject({
      method: "GET",
      url: "/api/v1/admin/orders",
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    await app.close();
  });
});
