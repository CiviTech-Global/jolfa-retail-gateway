import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import { authenticate } from "../../shared/middleware/auth.js";
import { validateRequest } from "../../shared/middleware/validate-request.js";
import * as paymentController from "./payment.controller.js";
import {
  paymentParamsSchema,
  paymentRequestBodySchema,
  paymentVerifyBodySchema,
  zibalCallbackQuerySchema,
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

  // Zibal returns the customer here with a GET query string, so this cannot be
  // the POST /verify route. Unauthenticated by necessity: the browser arrives
  // from the gateway carrying no session cookie for us, and the trackId is the
  // only thing identifying the payment. That is safe because the endpoint
  // decides nothing — it asks Zibal what happened and redirects.
  app.get(
    "/callback/zibal",
    { preHandler: [validateRequest({ query: zibalCallbackQuerySchema })] },
    paymentController.zibalCallback
  );

  app.get(
    "/:authority",
    { preHandler: [authenticate, validateRequest({ params: paymentParamsSchema })] },
    paymentController.getPaymentByAuthority
  );
}
