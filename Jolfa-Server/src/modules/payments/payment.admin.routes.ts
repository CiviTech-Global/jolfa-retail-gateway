import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import { authenticate, authorize } from "../../shared/middleware/auth.js";
import { validateRequest } from "../../shared/middleware/validate-request.js";
import { z } from "zod";
import { listPaymentsForAdmin, listTransactions, createRefund } from "./transaction.service.js";
import { getPaymentModeStatus, setLiveMode } from "./payment-mode.service.js";

const adminPaymentQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.string().optional(),
  gateway: z.string().optional(),
});

const transactionQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  orderId: z.string().uuid().optional(),
  paymentId: z.string().uuid().optional(),
  status: z.enum(["PENDING", "COMPLETED", "FAILED"]).optional(),
  type: z.enum(["PAYMENT", "REFUND", "RETRY", "FEE", "ADJUSTMENT"]).optional(),
});

const orderParamsSchema = z.object({
  id: z.string().uuid(),
});

const paymentModeBodySchema = z.object({
  live: z.boolean({ required_error: "حالت پرداخت الزامی است" }),
});

const refundBodySchema = z.object({
  amount: z.number().int().positive(),
});

export default async function paymentAdminRoutes(
  app: FastifyInstance,
  _options: FastifyPluginOptions,
): Promise<void> {
  const adminPreHandler = [authenticate, authorize("ADMIN")];

  app.get(
    "/payments",
    { preHandler: [...adminPreHandler, validateRequest({ query: adminPaymentQuerySchema })] },
    async (request, reply) => {
      const data = await listPaymentsForAdmin(request.query as never);
      return reply.status(200).send({ success: true, data });
    },
  );

  app.get(
    "/transactions",
    { preHandler: [...adminPreHandler, validateRequest({ query: transactionQuerySchema })] },
    async (request, reply) => {
      const data = await listTransactions(request.query as never);
      return reply.status(200).send({ success: true, data });
    },
  );

  app.get("/payments/mode", { preHandler: adminPreHandler }, async (_request, reply) => {
    return reply.status(200).send({ success: true, data: await getPaymentModeStatus() });
  });

  // The one door to the live/sandbox switch. Deliberately not the generic
  // settings endpoint: going live has a precondition (a real merchant id) and
  // needs an audit trail, neither of which a generic key/value write provides.
  app.patch(
    "/payments/mode",
    { preHandler: [...adminPreHandler, validateRequest({ body: paymentModeBodySchema })] },
    async (request, reply) => {
      const body = request.body as { live: boolean };
      const data = await setLiveMode(body.live, request.user.id);
      return reply.status(200).send({ success: true, data });
    },
  );

  app.post(
    "/orders/:id/refund",
    {
      preHandler: [
        ...adminPreHandler,
        validateRequest({ params: orderParamsSchema, body: refundBodySchema }),
      ],
    },
    async (request, reply) => {
      const params = request.params as { id: string };
      const body = request.body as { amount: number };
      const transaction = await createRefund(params.id, body.amount, request.user.id);
      return reply.status(201).send({ success: true, data: { transaction } });
    },
  );
}
