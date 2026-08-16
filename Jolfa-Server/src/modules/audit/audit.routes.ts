import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import { authenticate, authorize } from "../../shared/middleware/auth.js";
import { listAuditLogsController } from "./audit.controller.js";

export default async function auditRoutes(
  app: FastifyInstance,
  _options: FastifyPluginOptions,
): Promise<void> {
  app.get(
    "/audit-logs",
    { preHandler: [authenticate, authorize("ADMIN")] },
    listAuditLogsController,
  );
}
