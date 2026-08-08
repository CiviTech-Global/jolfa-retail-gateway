import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import { authenticate } from "../../shared/middleware/auth.js";
import { validateRequest } from "../../shared/middleware/validate-request.js";
import * as paymentController from "./payment.controller.js";
import {
  paymentParamsSchema,
  paymentRequestBodySchema,
  paymentVerifyBodySchema,
} from "./payment.types.js";

export default async function paymentRoutes(
  app: FastifyInstance,
  _options: FastifyPluginOptions
): Promise<void> {
  app.post(
    "/request",
    { preHandler: [authenticate, validateRequest({ body: paymentRequestBodySchema })] },
    paymentController.requestPayment
  );

  app.post(
    "/verify",
    { preHandler: [validateRequest({ body: paymentVerifyBodySchema })] },
    paymentController.verifyPayment
  );

  app.get(
    "/:authority",
    { preHandler: [authenticate, validateRequest({ params: paymentParamsSchema })] },
    paymentController.getPaymentByAuthority
  );
}
