import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import multipart from "@fastify/multipart";
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

const app = Fastify({
  logger: {
    level: env.NODE_ENV === "production" ? "info" : "debug",
  },
});

async function bootstrap(): Promise<void> {
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

  app.get("/health", async (_request, reply) => {
    return reply.status(200).send({
      success: true,
      data: { status: "ok", timestamp: new Date().toISOString() },
    });
  });

  await app.register(categoryRoutes, { prefix: `${env.API_PREFIX}/categories` });
  await app.register(productRoutes, { prefix: `${env.API_PREFIX}/products` });
  await app.register(authRoutes, { prefix: `${env.API_PREFIX}/auth` });
  await app.register(orderRoutes, { prefix: `${env.API_PREFIX}/orders` });
  await app.register(paymentRoutes, { prefix: `${env.API_PREFIX}/payments` });
  await app.register(adminRoutes, { prefix: `${env.API_PREFIX}/admin` });
  await app.register(settingsRoutes, { prefix: `${env.API_PREFIX}/settings` });
  await app.register(homepageSectionRoutes, { prefix: `${env.API_PREFIX}/homepage-sections` });
  await app.register(demoRoutes, { prefix: `${env.API_PREFIX}/demo` });
  await app.register(dashboardRoutes, { prefix: `${env.API_PREFIX}/dashboard` });
  await app.register(bannerRoutes, { prefix: `${env.API_PREFIX}/banners` });

  app.setErrorHandler((error, _request, reply) => {
    const err = error instanceof Error ? error : new Error(String(error));
    const statusCode =
      "statusCode" in err && typeof err.statusCode === "number" ? err.statusCode : 500;
    const code = "code" in err && typeof err.code === "string" ? err.code : "INTERNAL_ERROR";
    const details =
      "details" in err && err.details !== undefined ? err.details : undefined;
    return reply.status(statusCode).send({
      success: false,
      error: {
        code,
        message: err.message,
        ...(details ? { details } : {}),
      },
    });
  });

  await app.listen({ port: env.PORT, host: env.HOST });
}

bootstrap().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});

export { app };
