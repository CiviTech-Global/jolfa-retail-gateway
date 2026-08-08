import type { FastifyReply, FastifyRequest } from "fastify";
import { sendSuccess } from "../../shared/reply.js";
import { asyncHandler } from "../../shared/async-handler.js";
import * as dashboardService from "./dashboard.service.js";

export const getDashboardStats = asyncHandler(
  async (_req: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const result = await dashboardService.getDashboardStats();
    sendSuccess(reply, result);
  }
);
