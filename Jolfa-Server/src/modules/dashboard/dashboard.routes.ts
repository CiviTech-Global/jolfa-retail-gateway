import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import { authenticate, authorize } from "../../shared/middleware/auth.js";
import * as dashboardController from "./dashboard.controller.js";

export default async function dashboardRoutes(
  app: FastifyInstance,
  _options: FastifyPluginOptions
): Promise<void> {
  app.get(
    "/",
    { preHandler: [authenticate, authorize("ADMIN")] },
    dashboardController.getDashboardStats
  );
}
