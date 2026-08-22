import "dotenv/config";
import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import multipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import { ZodError } from "zod";
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
import uploadRoutes from "./modules/uploads/upload.routes.js";
import { getUploadDir } from "./modules/uploads/upload.service.js";
import path from "node:path";
import { pathToFileURL } from "node:url";
import auditRoutes from "./modules/audit/audit.routes.js";
import userRoutes from "./modules/users/user.routes.js";
import { seedDefaults } from "./shared/seed.js";
import paymentAdminRoutes from "./modules/payments/payment.admin.routes.js";
import orderAdminRoutes from "./modules/orders/order.admin.routes.js";
import { registerRequestLogging } from "./shared/logging.js";

export function createFastifyInstance(): FastifyInstance {
  return Fastify({
    // Tests build dozens of app instances and assert on injected responses,
    // not on logs; leaving the logger on buries the reporter output in pino
    // JSON (including the expected 4xx warnings each auth test provokes).
    logger: env.NODE_ENV === "test" ? false : {
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

  await app.register(cors, {
    origin: env.CORS_ORIGIN === "*" ? true : env.CORS_ORIGIN.split(","),
    credentials: true,
  });

  await app.register(jwt, {
    secret: env.JWT_SECRET,
  });

  await app.register(multipart, {
    limits: {
      fileSize: env.MAX_FILE_SIZE,
    },
  });

  await app.register(fastifyStatic, {
    root: getUploadDir(),
    prefix: env.PUBLIC_UPLOAD_PATH,
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
  await app.register(uploadRoutes, { prefix: `${env.API_PREFIX}/uploads` });

  return app;
}

async function bootstrap(): Promise<void> {
  const app = createFastifyInstance();
  await buildApp(app);
  await seedDefaults();
  await app.listen({ port: env.PORT, host: env.HOST });
}

const isMainModule = Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMainModule) {
  bootstrap().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}
