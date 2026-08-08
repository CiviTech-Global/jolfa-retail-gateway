import type { FastifyReply, FastifyRequest } from "fastify";
import { sendSuccess } from "../../shared/reply.js";
import { asyncHandler } from "../../shared/async-handler.js";
import { seedDemoData, clearDemoData } from "./demo.service.js";
import type { DemoActionBody } from "./demo.types.js";

export const runDemoAction = asyncHandler(
  async (
    request: FastifyRequest<{ Body: DemoActionBody }>,
    reply: FastifyReply
  ) => {
    if (request.body.action === "seed") {
      await seedDemoData();
      sendSuccess(reply, { action: "seed" }, 200);
      return;
    }

    await clearDemoData();
    sendSuccess(reply, { action: "clear" }, 200);
  }
);
