import type { FastifyReply, FastifyRequest } from "fastify";
import { sendSuccess } from "../../shared/reply.js";
import { asyncHandler } from "../../shared/async-handler.js";
import * as dashboardService from "./dashboard.service.js";

export const getDashboardStats = asyncHandler(
  async (request: FastifyRequest<{ Querystring: { days?: string } }>, reply: FastifyReply): Promise<void> => {
    const days = Math.min(90, Math.max(1, Number(request.query.days) || 7));
    const result = await dashboardService.getDashboardStats(days);
    sendSuccess(reply, result);
  },
);
