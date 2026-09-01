import "dotenv/config";
import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import jwt from "@fastify/jwt";
import multipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import { ZodError } from "zod";
import { TooManyRequestsError } from "./shared/app-error.js";
import { env } from "./config/env.js";
import categoryRoutes from "./modules/categories/category.routes.js";
import productRoutes from "./modules/products/product.routes.js";
import orderRoutes from "./modules/orders/order.routes.js";
import paymentRoutes from "./modules/payments/payment.routes.js";
import adminRoutes from "./modules/admin/admin.routes.js";
import { authRoutes } from "./modules/auth/auth.routes.js";
import settingsRoutes from "./modules/settings/settings.routes.js";
import homepageSectionRoutes from "./modules/homepage-sections/homepage-section.routes.js";
import demoRoutes from "./modules/demo/demo.routes.js";
import dashboardRoutes from "./modules/dashboard/dashboard.routes.js";
import bannerRoutes from "./modules/banners/banner.routes.js";
import addressRoutes from "./modules/addresses/address.routes.js";
import uploadRoutes from "./modules/uploads/upload.routes.js";
import { getUploadDir } from "./modules/uploads/upload.service.js";
import path from "node:path";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { realpathSync } from "node:fs";
import auditRoutes from "./modules/audit/audit.routes.js";
import userRoutes from "./modules/users/user.routes.js";
import { seedDefaults } from "./shared/seed.js";
import paymentAdminRoutes from "./modules/payments/payment.admin.routes.js";
import orderAdminRoutes from "./modules/orders/order.admin.routes.js";
import { registerRequestLogging } from "./shared/logging.js";
import { registerCacheHeaders } from "./shared/caching.js";
import { registerCrashHandlers } from "./shared/crash-handlers.js";

export function createFastifyInstance(): FastifyInstance {
  return Fastify({
    logger: {
      level: env.NODE_ENV === "production" ? "info" : "debug",
      redact: {
        paths: [
          "req.headers.authorization",
          "req.headers.cookie",
          "body.password",
          "body.token",
          "body.confirmPassword",
        ],
        censor: "[REDACTED]",
      },
    },
  });
}

/**
 * Registers every plugin/route/error-handler on the given app instance without
 * binding a port. Kept separate from `bootstrap()` so tests can build a fully
 * wired app and drive it with `app.inject()` instead of a real network listener.
 */
export async function buildApp(app: FastifyInstance): Promise<FastifyInstance> {
  registerRequestLogging(app);
  registerCacheHeaders(app, env.API_PREFIX);

  // `origin: true` reflects whatever Origin the caller sent. Paired with
  // `credentials: true` that lets any site read authenticated responses, so the
  // wildcard drops credentials instead of silently becoming a hole.
  const allowAnyOrigin = env.CORS_ORIGIN === "*";
  await app.register(cors, {
    origin: allowAnyOrigin ? true : env.CORS_ORIGIN.split(","),
    credentials: !allowAnyOrigin,
  });

  await app.register(helmet, {
    // The API serves JSON and uploaded images, never HTML, so the restrictive
    // default CSP costs nothing here.
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        imgSrc: ["'self'", "data:"],
        scriptSrc: ["'none'"],
      },
    },
    crossOriginResourcePolicy: { policy: "cross-origin" },
  });

  // Registered before the routes so every route inherits the global bucket.
  // Individual routes tighten it with `config.rateLimit`.
  await app.register(rateLimit, {
    global: true,
    max: env.RATE_LIMIT_MAX,
    timeWindow: env.RATE_LIMIT_WINDOW,
    // Health checks come from monitoring, not users, and must never be limited.
    allowList: (request) => request.url === "/health",
    // Must be a real Error: the app's error handler coerces non-Errors into a
    // bare Error, which would lose the 429 and report the throttle as a 500.
    errorResponseBuilder: (_request, context) =>
      new TooManyRequestsError(
        `درخواست‌های شما بیش از حد مجاز است. لطفاً ${context.after} دیگر تلاش کنید.`,
      ),
  });

  await app.register(jwt, {
    secret: env.JWT_SECRET,
  });

  await app.register(multipart, {
    limits: {
      fileSize: env.MAX_FILE_SIZE,
    },
  });

  // @fastify/static resolves its root at registration time and warns (then
  // serves nothing) when the directory is missing, which is the normal state
  // on a fresh deploy before the first upload lands.
  await mkdir(getUploadDir(), { recursive: true });

  // Uploaded files are content-addressed by a random UUID filename and never
  // rewritten, so they can be cached forever. In production Nginx should serve
  // this path directly and never wake Node at all — see docs DEPLOY.md §11.
  await app.register(fastifyStatic, {
    root: getUploadDir(),
    prefix: env.PUBLIC_UPLOAD_PATH,
    maxAge: "365d",
    immutable: true,
  });

  await app.register(fastifyStatic, {
    root: path.resolve("assets/demo-images"),
    prefix: "/demo-assets/",
    decorateReply: false,
  });

  app.get("/health", async (_request, reply) => {
    return reply.status(200).send({
      success: true,
      data: { status: "ok", timestamp: new Date().toISOString() },
    });
  });

  // Must be registered before any routes: Fastify's route Context snapshots
  // the current error handler at registration time, so routes registered
  // beforehand would silently keep the default handler.
  app.setErrorHandler((error, request, reply) => {
    const err = error instanceof Error ? error : new Error(String(error));

    if (err instanceof ZodError) {
      const logPayload = {
        reqId: request.id,
        method: request.method,
        url: request.url,
        statusCode: 400,
        code: "VALIDATION_ERROR",
      };
      request.log.warn(logPayload, err.message);
      return reply.status(400).send({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: err.issues[0]?.message ?? "ورودی نامعتبر است",
          details: { issues: err.issues },
        },
      });
    }

    const statusCode =
      "statusCode" in err && typeof err.statusCode === "number" ? err.statusCode : 500;
    const code = "code" in err && typeof err.code === "string" ? err.code : "INTERNAL_ERROR";
    const details =
      "details" in err && err.details !== undefined ? err.details : undefined;

    const logPayload = {
      reqId: request.id,
      method: request.method,
      url: request.url,
      statusCode,
      code,
      ...(env.NODE_ENV === "production" ? {} : { stack: err.stack }),
    };
    if (statusCode >= 500) {
      request.log.error(logPayload, err.message);
    } else {
      request.log.warn(logPayload, err.message);
    }

    return reply.status(statusCode).send({
      success: false,
      error: {
        code,
        message: err.message,
        ...(details ? { details } : {}),
      },
    });
  });

  await app.register(categoryRoutes, { prefix: `${env.API_PREFIX}/categories` });
  await app.register(productRoutes, { prefix: `${env.API_PREFIX}/products` });
  await app.register(authRoutes, { prefix: `${env.API_PREFIX}/auth` });
  await app.register(orderRoutes, { prefix: `${env.API_PREFIX}/orders` });
  await app.register(paymentRoutes, { prefix: `${env.API_PREFIX}/payments` });
  await app.register(adminRoutes, { prefix: `${env.API_PREFIX}/admin` });
  await app.register(auditRoutes, { prefix: `${env.API_PREFIX}/admin` });
  await app.register(userRoutes, { prefix: `${env.API_PREFIX}/admin` });
  await app.register(paymentAdminRoutes, { prefix: `${env.API_PREFIX}/admin` });
  await app.register(orderAdminRoutes, { prefix: `${env.API_PREFIX}/admin` });
  await app.register(settingsRoutes, { prefix: `${env.API_PREFIX}/settings` });
  await app.register(homepageSectionRoutes, { prefix: `${env.API_PREFIX}/homepage-sections` });
  await app.register(demoRoutes, { prefix: `${env.API_PREFIX}/demo` });
  await app.register(dashboardRoutes, { prefix: `${env.API_PREFIX}/dashboard` });
  await app.register(bannerRoutes, { prefix: `${env.API_PREFIX}/banners` });
  await app.register(addressRoutes, { prefix: `${env.API_PREFIX}/addresses` });
  await app.register(uploadRoutes, { prefix: `${env.API_PREFIX}/uploads` });

  return app;
}

/**
 * Stops accepting new connections, lets in-flight requests finish, then closes
 * the database pool. Without this a deploy kills the process mid-request and
 * the customer sees a failed checkout rather than a moment of latency.
 */
function registerShutdownHandlers(app: FastifyInstance): void {
  let shuttingDown = false;

  const shutdown = async (signal: string): Promise<void> => {
    // A second Ctrl-C should not start a parallel teardown.
    if (shuttingDown) return;
    shuttingDown = true;

    app.log.info({ signal }, "shutting down");

    // Backstop: if a request hangs, exit anyway rather than blocking the deploy
    // forever. Process managers send SIGKILL eventually; this is tidier.
    const forceExit = setTimeout(() => {
      app.log.error("graceful shutdown timed out, forcing exit");
      process.exit(1);
    }, 10_000);
    forceExit.unref();

    try {
      await app.close();
      const { prisma } = await import("./shared/prisma.js");
      await prisma.$disconnect();
      app.log.info("shutdown complete");
      process.exit(0);
    } catch (error) {
      app.log.error({ err: error }, "error during shutdown");
      process.exit(1);
    }
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

async function bootstrap(): Promise<void> {
  const app = createFastifyInstance();
  await buildApp(app);
  await seedDefaults();
  registerCrashHandlers(app);
  registerShutdownHandlers(app);
  await app.listen({ port: env.PORT, host: env.HOST });
}

/**
 * True when this file is the process entrypoint, rather than something a test
 * imported for `buildApp`.
 *
 * Comparing `import.meta.url` to `pathToFileURL(process.argv[1])` looks
 * correct and fails in production for two independent reasons:
 *
 * 1. A process manager launches its own wrapper and loads the application
 *    inside it, so `argv[1]` is the wrapper's path. PM2's record of what it was
 *    actually asked to run (`pm_exec_path`) is checked as well.
 * 2. The deployment runs from a `current` symlink pointing at a timestamped
 *    release directory. Node resolves the entrypoint to its *real* path, while
 *    the process manager reports the symlinked one — so two strings that name
 *    the same file never compare equal. Both sides are resolved with
 *    `realpathSync` before comparing.
 *
 * When this check is wrong the server does not crash, which is what makes it
 * expensive: the process stays up, the manager reports it healthy, nothing
 * listens on the port, and the log is empty.
 */
function resolveRealPath(candidate: string): string | undefined {
  try {
    return realpathSync(candidate);
  } catch {
    // argv[1] can name something that no longer exists; that just means it is
    // not this file.
    return undefined;
  }
}

const thisFile = resolveRealPath(fileURLToPath(import.meta.url));
const isMainModule =
  thisFile !== undefined &&
  [process.argv[1], process.env.pm_exec_path]
    .filter((candidate): candidate is string => Boolean(candidate))
    .some((candidate) => resolveRealPath(candidate) === thisFile);

if (isMainModule) {
  bootstrap().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}
