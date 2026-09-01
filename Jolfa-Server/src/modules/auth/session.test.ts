import { describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { createTestApp } from "../../../test/helpers/build-app.js";
import { createTestUser } from "../../../test/helpers/factories.js";
import { prisma } from "../../shared/prisma.js";

/**
 * The refresh token used to be issued at login with no endpoint that accepted
 * it, and there was no way to end a session at all: a stolen access token stayed
 * valid until it expired, and changing your password did nothing to other
 * devices. These cover the mechanism that replaced that.
 */

async function loginFresh(app: FastifyInstance) {
  const { user, password } = await createTestUser();
  const res = await app.inject({
    method: "POST",
    url: "/api/v1/auth/login",
    payload: { phone: user.phone, password },
  });
  expect(res.statusCode).toBe(200);
  return { user, password, tokens: res.json().data.tokens as { accessToken: string; refreshToken: string } };
}

describe("POST /api/v1/auth/refresh", () => {
  it("exchanges a refresh token for a working new pair", async () => {
    const app = await createTestApp();
    const { tokens } = await loginFresh(app);

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/refresh",
      payload: { refreshToken: tokens.refreshToken },
    });

    expect(res.statusCode).toBe(200);
    const fresh = res.json().data.tokens;
    expect(fresh.accessToken).toBeTruthy();
    expect(fresh.refreshToken).toBeTruthy();

    const me = await app.inject({
      method: "GET",
      url: "/api/v1/auth/me",
      headers: { authorization: `Bearer ${fresh.accessToken}` },
    });
    expect(me.statusCode).toBe(200);

    await app.close();
  });

  it("refuses an access token presented as a refresh token", async () => {
    // Both are signed with the same key, so only the token type separates them.
    const app = await createTestApp();
    const { tokens } = await loginFresh(app);

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/refresh",
      payload: { refreshToken: tokens.accessToken },
    });

    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it("refuses a garbage token", async () => {
    const app = await createTestApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/refresh",
      payload: { refreshToken: "not.a.jwt" },
    });

    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it("refuses to refresh a deactivated account", async () => {
    const app = await createTestApp();
    const { user, tokens } = await loginFresh(app);

    await prisma.user.update({ where: { id: user.id }, data: { isActive: false } });

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/refresh",
      payload: { refreshToken: tokens.refreshToken },
    });

    expect(res.statusCode).toBe(401);
    await app.close();
  });
});

describe("a refresh token cannot authenticate a request", () => {
  it("rejects it on a protected route", async () => {
    const app = await createTestApp();
    const { tokens } = await loginFresh(app);

    const res = await app.inject({
      method: "GET",
      url: "/api/v1/auth/me",
      headers: { authorization: `Bearer ${tokens.refreshToken}` },
    });

    expect(res.statusCode).toBe(401);
    await app.close();
  });
});

describe("POST /api/v1/auth/logout", () => {
  it("invalidates the access token it was called with", async () => {
    const app = await createTestApp();
    const { tokens } = await loginFresh(app);

    const before = await app.inject({
      method: "GET",
      url: "/api/v1/auth/me",
      headers: { authorization: `Bearer ${tokens.accessToken}` },
    });
    expect(before.statusCode).toBe(200);

    const logout = await app.inject({
      method: "POST",
      url: "/api/v1/auth/logout",
      headers: { authorization: `Bearer ${tokens.accessToken}` },
    });
    expect(logout.statusCode).toBe(200);

    const after = await app.inject({
      method: "GET",
      url: "/api/v1/auth/me",
      headers: { authorization: `Bearer ${tokens.accessToken}` },
    });
    expect(after.statusCode).toBe(401);

    await app.close();
  });

  it("invalidates the matching refresh token too", async () => {
    // Otherwise logging out would be undone by the next silent refresh.
    const app = await createTestApp();
    const { tokens } = await loginFresh(app);

    await app.inject({
      method: "POST",
      url: "/api/v1/auth/logout",
      headers: { authorization: `Bearer ${tokens.accessToken}` },
    });

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/refresh",
      payload: { refreshToken: tokens.refreshToken },
    });

    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it("requires authentication", async () => {
    const app = await createTestApp();
    const res = await app.inject({ method: "POST", url: "/api/v1/auth/logout" });
    expect(res.statusCode).toBe(401);
    await app.close();
  });
});

describe("changing a password ends other sessions", () => {
  it("invalidates tokens issued before the change", async () => {
    const app = await createTestApp();
    const { user, password, tokens } = await loginFresh(app);

    // A second device, holding its own tokens from the same account.
    const second = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { phone: user.phone, password },
    });
    const otherDevice = second.json().data.tokens;

    const changed = await app.inject({
      method: "POST",
      url: "/api/v1/auth/change-password",
      headers: { authorization: `Bearer ${tokens.accessToken}` },
      payload: { currentPassword: password, newPassword: "brand-new-password-1" },
    });
    expect(changed.statusCode).toBe(200);

    // The other device is signed out, which is the entire point of changing a
    // password you think someone else may know.
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/auth/me",
      headers: { authorization: `Bearer ${otherDevice.accessToken}` },
    });
    expect(res.statusCode).toBe(401);

    await app.close();
  });
});

describe("deactivating an account takes effect immediately", () => {
  it("rejects an already-issued token", async () => {
    const app = await createTestApp();
    const { user, tokens } = await loginFresh(app);

    await prisma.user.update({ where: { id: user.id }, data: { isActive: false } });

    const res = await app.inject({
      method: "GET",
      url: "/api/v1/auth/me",
      headers: { authorization: `Bearer ${tokens.accessToken}` },
    });

    expect(res.statusCode).toBe(401);
    await app.close();
  });
});
