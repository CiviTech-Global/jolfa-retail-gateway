import type { FastifyReply, FastifyRequest } from "fastify";
import { sendSuccess } from "../../shared/reply.js";
import { asyncHandler } from "../../shared/async-handler.js";
import * as paymentService from "./payment.service.js";
import type { PaymentParams, PaymentRequestBody, PaymentVerifyBody } from "./payment.types.js";

export const requestPayment = asyncHandler(
  async (
    request: FastifyRequest<{ Body: PaymentRequestBody }>,
    reply: FastifyReply
  ): Promise<void> => {
    const user = request.user;
    const result = await paymentService.requestPayment(user.id, request.body);
    sendSuccess(reply, result);
  }
);

export const verifyPayment = asyncHandler(
  async (
    request: FastifyRequest<{ Body: PaymentVerifyBody }>,
    reply: FastifyReply
  ): Promise<void> => {
    const result = await paymentService.verifyPayment(request.body);
    sendSuccess(reply, result);
  }
);

export const getPaymentByAuthority = asyncHandler(
  async (
    request: FastifyRequest<{ Params: PaymentParams }>,
    reply: FastifyReply
  ): Promise<void> => {
    const result = await paymentService.getPaymentByAuthority(request.params.authority);
    sendSuccess(reply, result);
  }
);
