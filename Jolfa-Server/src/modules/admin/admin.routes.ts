import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import { authenticate, authorize } from "../../shared/middleware/auth.js";
import { validateRequest } from "../../shared/middleware/validate-request.js";
import * as orderController from "../orders/order.controller.js";
import { orderListQuerySchema, orderParamsSchema, orderStatusUpdateSchema } from "../orders/order.types.js";

export default async function adminRoutes(
  app: FastifyInstance,
  _options: FastifyPluginOptions
): Promise<void> {
  app.get(
    "/orders",
    {
      preHandler: [
        authenticate,
        authorize("ADMIN"),
        validateRequest({ query: orderListQuerySchema }),
      ],
    },
    orderController.listAdminOrders
  );

  app.patch(
    "/orders/:id/status",
    {
      preHandler: [
        authenticate,
        authorize("ADMIN"),
        validateRequest({ params: orderParamsSchema, body: orderStatusUpdateSchema }),
      ],
    },
    orderController.updateOrderStatus
  );
}
