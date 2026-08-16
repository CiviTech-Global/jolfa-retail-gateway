import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import { authenticate, authorize } from "../../shared/middleware/auth.js";
import { validateRequest } from "../../shared/middleware/validate-request.js";
import { z } from "zod";
import * as orderAdminController from "./order.admin.controller.js";
import { orderParamsSchema } from "./order.types.js";

const trackingBodySchema = z.object({
  trackingNumber: z.string().min(1).max(100),
});

const cancelBodySchema = z.object({
  reason: z.string().max(1000).optional(),
});

export default async function orderAdminRoutes(
  app: FastifyInstance,
  _options: FastifyPluginOptions,
): Promise<void> {
  const adminPreHandler = [authenticate, authorize("ADMIN")];

  app.get(
    "/orders/:id",
    { preHandler: [...adminPreHandler, validateRequest({ params: orderParamsSchema })] },
    orderAdminController.getAdminOrderDetail,
  );

  app.patch(
    "/orders/:id/tracking",
    {
      preHandler: [
        ...adminPreHandler,
        validateRequest({ params: orderParamsSchema, body: trackingBodySchema }),
      ],
    },
    orderAdminController.updateOrderTracking,
  );

  app.post(
    "/orders/:id/cancel",
    {
      preHandler: [
        ...adminPreHandler,
        validateRequest({ params: orderParamsSchema, body: cancelBodySchema }),
      ],
    },
    orderAdminController.cancelOrder,
  );
}
