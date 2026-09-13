import type { FastifyReply, FastifyRequest } from "fastify";
import { sendSuccess } from "../../shared/reply.js";
import { asyncHandler } from "../../shared/async-handler.js";
import * as paymentService from "./payment.service.js";
import { env } from "../../config/env.js";
import { logger } from "../../shared/logger.js";
import type {
  PaymentParams,
  PaymentRequestBody,
  PaymentVerifyBody,
  ZibalCallbackQuery,
} from "./payment.types.js";

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

/**
 * Where Zibal returns the customer after they pay.
 *
 * This is a browser navigation, not an API call, so it answers with a redirect
 * rather than JSON: the person is sitting in front of a loading page and has to
 * end up somewhere they can read. The settlement happens first — `verifyPayment`
 * asks Zibal what really happened — and only then is the browser sent on to the
 * SPA's result page.
 *
 * It never throws to the error handler. A customer who has just been charged
 * must not meet a JSON 500; whatever goes wrong, they are redirected to a page
 * that explains the situation and the failure is logged for us to chase.
 */
export const zibalCallback = asyncHandler(
  async (
    request: FastifyRequest<{ Querystring: ZibalCallbackQuery }>,
    reply: FastifyReply
  ): Promise<void> => {
    const { trackId, success, status } = request.query;
    const resultPage = `${env.APP_URL}/payment/callback`;

    try {
      const result = await paymentService.verifyPayment({ authority: trackId });
      const params = new URLSearchParams({
        authority: trackId,
        status: result.success ? "OK" : "NOK",
      });
      if (result.refId) params.set("refId", result.refId);
      if (!result.success && "reason" in result && result.reason) {
        params.set("reason", String(result.reason));
      }
      await reply.redirect(`${resultPage}?${params.toString()}`, 302);
    } catch (error) {
      logger.error({ err: error, trackId, success, status }, "zibal callback failed to settle");
      const params = new URLSearchParams({ authority: trackId, status: "NOK" });
      await reply.redirect(`${resultPage}?${params.toString()}`, 302);
    }
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
