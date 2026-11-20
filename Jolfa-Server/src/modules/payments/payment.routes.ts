import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import { authenticate } from "../../shared/middleware/auth.js";
import { validateRequest } from "../../shared/middleware/validate-request.js";
import * as paymentController from "./payment.controller.js";
import {
  paymentParamsSchema,
  paymentRequestBodySchema,
  paymentMethodsQuerySchema,
  paymentVerifyBodySchema,
  torobPayReturnSchema,
  zibalCallbackQuerySchema,
} from "./payment.types.js";

export default async function paymentRoutes(
  app: FastifyInstance,
  _options: FastifyPluginOptions
): Promise<void> {
  // TorobPay returns the customer with an HTML form POST. Parsed here rather
  // than with a plugin: it is the only form body the API accepts, and keeping
  // the parser inside this plugin keeps it off every other route.
  app.addContentTypeParser(
    "application/x-www-form-urlencoded",
    { parseAs: "string", bodyLimit: 4096 },
    (_request, body, done) => {
      done(null, Object.fromEntries(new URLSearchParams(body as string)));
    },
  );

  // Which payment methods to show for a cart. TorobPay asks to be consulted on
  // every checkout, and only offered when it says yes.
  app.get(
    "/methods",
    { preHandler: [authenticate, validateRequest({ query: paymentMethodsQuerySchema })] },
    paymentController.listPaymentMethods
  );

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

  // Where TorobPay posts the customer back. Unauthenticated for the same
  // reason as Zibal's callback, and safe for the same reason: it decides
  // nothing, it asks TorobPay what happened and redirects.
  app.post(
    "/callback/torobpay",
    { preHandler: [validateRequest({ body: torobPayReturnSchema })] },
    paymentController.torobPayCallback
  );

  app.get(
    "/:authority",
    { preHandler: [authenticate, validateRequest({ params: paymentParamsSchema })] },
    paymentController.getPaymentByAuthority
  );
}
