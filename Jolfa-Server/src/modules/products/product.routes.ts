import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import { authenticate, authorize } from "../../shared/middleware/auth.js";
import { validateRequest } from "../../shared/middleware/validate-request.js";
import {
  productCreateBodySchema,
  productListQuerySchema,
  productParamsSchema,
  productUpdateBodySchema,
} from "./product.types.js";
import * as productController from "./product.controller.js";

export default async function productRoutes(
  app: FastifyInstance,
  _options: FastifyPluginOptions
): Promise<void> {
  app.get(
    "/",
    { preHandler: [validateRequest({ query: productListQuerySchema })] },
    productController.listProducts
  );

  app.get(
    "/:slug",
    { preHandler: [validateRequest({ params: productParamsSchema })] },
    productController.getProductBySlug
  );

  app.post(
    "/",
    {
      preHandler: [
        authenticate,
        authorize("ADMIN"),
        validateRequest({ body: productCreateBodySchema }),
      ],
    },
    productController.createProduct
  );

  app.patch(
    "/:slug",
    {
      preHandler: [
        authenticate,
        authorize("ADMIN"),
        validateRequest({ params: productParamsSchema, body: productUpdateBodySchema }),
      ],
    },
    productController.updateProduct
  );

  app.delete(
    "/:slug",
    {
      preHandler: [
        authenticate,
        authorize("ADMIN"),
        validateRequest({ params: productParamsSchema }),
      ],
    },
    productController.deleteProduct
  );
}
