import type { FastifyReply, FastifyRequest } from "fastify";
import { sendSuccess } from "../../shared/reply.js";
import { asyncHandler } from "../../shared/async-handler.js";
import * as orderService from "./order.service.js";
import type { OrderParams } from "./order.types.js";

export const getAdminOrderDetail = asyncHandler(
  async (
    request: FastifyRequest<{ Params: OrderParams }>,
    reply: FastifyReply,
  ): Promise<void> => {
    const result = await orderService.getAdminOrderDetail(request.params.id);
    sendSuccess(reply, result);
  },
);

export const updateOrderTracking = asyncHandler(
  async (
    request: FastifyRequest<{ Params: OrderParams; Body: { trackingNumber: string } }>,
    reply: FastifyReply,
  ): Promise<void> => {
    const result = await orderService.updateOrderTracking(
      request.params.id,
      request.body.trackingNumber,
      request.user?.id,
    );
    sendSuccess(reply, result);
  },
);

export const cancelOrder = asyncHandler(
  async (
    request: FastifyRequest<{ Params: OrderParams; Body: { reason?: string } }>,
    reply: FastifyReply,
  ): Promise<void> => {
    const result = await orderService.cancelOrder(
      request.params.id,
      request.body.reason,
      request.user?.id,
    );
    sendSuccess(reply, result);
  },
);
