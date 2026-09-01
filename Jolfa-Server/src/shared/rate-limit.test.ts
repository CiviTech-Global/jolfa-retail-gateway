import { describe, expect, it } from "vitest";
import { createTestApp } from "../../test/helpers/build-app.js";
import { env } from "../config/env.js";

/**
 * Each `createTestApp()` gets its own in-memory limiter store, so a test that
 * deliberately exhausts a bucket cannot leak into the rest of the suite.
 *
 * `.env.test` raises the limits well above the production defaults; these tests
 * assert against `env` rather than hard-coded numbers so the two stay in step.
 */
async function hammer(url: string, times: number): Promise<number[]> {
  const app = await createTestApp();
  const codes: number[] = [];

  for (let i = 0; i < times; i += 1) {
    const res = await app.inject({
      method: "POST",
      url,
      payload: { phone: "09121234567", password: "wrong-password" },
    });
    codes.push(res.statusCode);
  }

  await app.close();
  return codes;
}

describe("auth rate limiting", () => {
  it("serves requests up to the auth limit, then returns 429", async () => {
    const limit = env.AUTH_RATE_LIMIT_MAX;
    const codes = await hammer("/api/v1/auth/login", limit + 3);

    // Nothing before the limit is throttled...
    expect(codes.slice(0, limit).every((code) => code !== 429)).toBe(true);
    // ...and everything after it is.
    expect(codes.slice(limit).every((code) => code === 429)).toBe(true);
  });

  it("throttles password reset, which costs real money per request", async () => {
    const limit = env.AUTH_RATE_LIMIT_MAX;
    const app = await createTestApp();

    const codes: number[] = [];
    for (let i = 0; i < limit + 2; i += 1) {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/auth/forgot-password",
        payload: { phone: "09121234567" },
      });
      codes.push(res.statusCode);
    }

    expect(codes.at(-1)).toBe(429);
    await app.close();
  });

  it("answers a throttled request in the app's standard error envelope", async () => {
    const codes = await hammer("/api/v1/auth/login", env.AUTH_RATE_LIMIT_MAX + 1);
    expect(codes.at(-1)).toBe(429);

    // Re-run to capture the body of a throttled response.
    const app = await createTestApp();
    for (let i = 0; i < env.AUTH_RATE_LIMIT_MAX; i += 1) {
      await app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        payload: { phone: "09121234567", password: "wrong-password" },
      });
    }
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { phone: "09121234567", password: "wrong-password" },
    });

    expect(res.statusCode).toBe(429);
    const body = res.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("RATE_LIMITED");
    // Persian, like every other user-facing message in the API.
    expect(body.error.message).toContain("بیش از حد مجاز");

    await app.close();
  });
});

describe("rate limiting exemptions", () => {
  it("never throttles the health endpoint", async () => {
    const app = await createTestApp();

    // Comfortably more than the auth bucket; monitoring must always get through.
    const codes: number[] = [];
    for (let i = 0; i < env.AUTH_RATE_LIMIT_MAX + 5; i += 1) {
      const res = await app.inject({ method: "GET", url: "/health" });
      codes.push(res.statusCode);
    }

    expect(codes.every((code) => code === 200)).toBe(true);
    await app.close();
  });

  it("keeps the global bucket looser than the auth bucket", async () => {
    // A shopper browsing the catalogue must never hit the auth-tier limit.
    expect(env.RATE_LIMIT_MAX).toBeGreaterThan(env.AUTH_RATE_LIMIT_MAX);
  });
});

describe("security headers", () => {
  it("sets the headers helmet is registered for", async () => {
    const app = await createTestApp();
    const res = await app.inject({ method: "GET", url: "/health" });

    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-frame-options"]).toBeDefined();
    expect(res.headers["content-security-policy"]).toContain("default-src 'self'");

    await app.close();
  });
});
