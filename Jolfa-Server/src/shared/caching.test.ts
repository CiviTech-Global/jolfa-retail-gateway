import { describe, expect, it } from "vitest";
import type { FastifyRequest } from "fastify";
import { isCacheablePath, resolveCacheControl } from "./caching.js";

const PREFIX = "/api/v1";

function req(overrides: Partial<{ method: string; url: string; authorization: string }> = {}) {
  return {
    method: overrides.method ?? "GET",
    url: overrides.url ?? `${PREFIX}/products`,
    headers: overrides.authorization ? { authorization: overrides.authorization } : {},
  } as unknown as FastifyRequest;
}

describe("isCacheablePath", () => {
  it("matches the public catalogue collections", () => {
    for (const path of ["/products", "/categories", "/banners", "/settings", "/homepage-sections"]) {
      expect(isCacheablePath(`${PREFIX}${path}`, PREFIX)).toBe(true);
    }
  });

  it("matches nested resources under a cacheable collection", () => {
    expect(isCacheablePath(`${PREFIX}/products/black-tea`, PREFIX)).toBe(true);
  });

  it("ignores the query string when matching", () => {
    expect(isCacheablePath(`${PREFIX}/products?page=2&sort=price:asc`, PREFIX)).toBe(true);
  });

  it("does not match personal or administrative paths", () => {
    for (const path of ["/orders", "/addresses", "/auth/me", "/admin/users", "/uploads"]) {
      expect(isCacheablePath(`${PREFIX}${path}`, PREFIX)).toBe(false);
    }
  });

  it("does not match a path that merely starts with a cacheable name", () => {
    // "/products-internal" must not inherit "/products"'s policy.
    expect(isCacheablePath(`${PREFIX}/products-internal`, PREFIX)).toBe(false);
  });

  it("ignores paths outside the API prefix", () => {
    expect(isCacheablePath("/health", PREFIX)).toBe(false);
  });
});

describe("resolveCacheControl", () => {
  it("allows shared caching of anonymous catalogue reads", () => {
    expect(resolveCacheControl(req(), 200, PREFIX)).toContain("public");
  });

  it("never caches a response to an authenticated request", () => {
    // The same handler serves shoppers and admins; an admin response must never
    // be stored where a shopper could be handed it.
    expect(resolveCacheControl(req({ authorization: "Bearer token" }), 200, PREFIX)).toBe(
      "no-store",
    );
  });

  it("never caches a mutation", () => {
    expect(resolveCacheControl(req({ method: "POST" }), 201, PREFIX)).toBe("no-store");
  });

  it("never caches personal data", () => {
    expect(resolveCacheControl(req({ url: `${PREFIX}/orders` }), 200, PREFIX)).toBe("no-store");
  });

  it("never caches an error response", () => {
    expect(resolveCacheControl(req(), 404, PREFIX)).toBe("no-store");
    expect(resolveCacheControl(req(), 500, PREFIX)).toBe("no-store");
  });
});
