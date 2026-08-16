import type { FastifyRequest, FastifyReply } from "fastify";
import { asyncHandler } from "../../shared/async-handler.js";
import { listAuditLogs, type AuditLogListFilters } from "../../shared/audit/audit.service.js";

export const listAuditLogsController = asyncHandler(
  async (
    request: FastifyRequest<{ Querystring: AuditLogListFilters }>,
    reply: FastifyReply,
  ) => {
    const data = await listAuditLogs(request.query);
    return reply.status(200).send({ success: true, data });
  },
);
