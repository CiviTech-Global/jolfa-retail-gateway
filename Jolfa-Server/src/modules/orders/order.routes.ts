import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import { authenticate } from "../../shared/middleware/auth.js";
import { validateRequest } from "../../shared/middleware/validate-request.js";
import * as orderController from "./order.controller.js";
import {
  orderCreateBodySchema,
  orderListQuerySchema,
  orderParamsSchema,
} from "./order.types.js";

export default async function orderRoutes(
  app: FastifyInstance,
  _options: FastifyPluginOptions
): Promise<void> {
  app.post(
    "/",
    { preHandler: [authenticate, validateRequest({ body: orderCreateBodySchema })] },
    orderController.createOrder
  );

  app.get(
    "/",
    { preHandler: [authenticate, validateRequest({ query: orderListQuerySchema })] },
    orderController.listUserOrders
  );

  app.get(
    "/:id",
    { preHandler: [authenticate, validateRequest({ params: orderParamsSchema })] },
    orderController.getOrderById
  );
}
