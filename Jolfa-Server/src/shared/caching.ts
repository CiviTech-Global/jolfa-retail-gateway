import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

/**
 * Public catalogue data changes when an admin edits it — rarely — and is read
 * constantly. A short shared cache absorbs repeat traffic without making the
 * store feel stale, and `stale-while-revalidate` means a cache refresh never
 * blocks a shopper.
 */
const PUBLIC_CACHE = "public, max-age=60, stale-while-revalidate=300";

/** Anything personal: never store it anywhere, at any layer. */
const PRIVATE_CACHE = "no-store";

/**
 * Path suffixes (after the API prefix) whose GET responses are identical for
 * every anonymous visitor. Deliberately a allowlist rather than a denylist —
 * a new endpoint is uncached until someone decides otherwise, which is the
 * safe direction to be wrong in.
 */
const CACHEABLE_PATHS = [
  "/products",
  "/categories",
  "/banners",
  "/settings",
  "/homepage-sections",
];

export function isCacheablePath(url: string, apiPrefix: string): boolean {
  const path = url.split("?")[0] ?? "";
  if (!path.startsWith(apiPrefix)) return false;

  const suffix = path.slice(apiPrefix.length);
  return CACHEABLE_PATHS.some(
    (prefix) => suffix === prefix || suffix.startsWith(`${prefix}/`),
  );
}

/**
 * Decides the Cache-Control header for a response.
 *
 * The presence of an Authorization header is the deciding factor, not the route:
 * the same `/products` handler serves anonymous and admin callers, and an admin
 * response must never land in a shared cache where a shopper could receive it.
 */
export function resolveCacheControl(
  request: FastifyRequest,
  statusCode: number,
  apiPrefix: string,
): string {
  if (request.method !== "GET") return PRIVATE_CACHE;
  if (request.headers.authorization) return PRIVATE_CACHE;
  if (statusCode >= 400) return PRIVATE_CACHE;
  if (!isCacheablePath(request.url, apiPrefix)) return PRIVATE_CACHE;
  return PUBLIC_CACHE;
}

export function registerCacheHeaders(app: FastifyInstance, apiPrefix: string): void {
  app.addHook("onSend", async (request: FastifyRequest, reply: FastifyReply, payload) => {
    // A handler that set its own policy wins.
    if (!reply.hasHeader("cache-control")) {
      reply.header("cache-control", resolveCacheControl(request, reply.statusCode, apiPrefix));
    }
    // Shared caches must key on Authorization, or an anonymous response could
    // be served to an admin and vice versa.
    reply.header("vary", "Authorization, Accept-Encoding");
    return payload;
  });
}
