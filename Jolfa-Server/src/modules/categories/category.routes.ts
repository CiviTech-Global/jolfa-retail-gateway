import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import { authenticate, authorize } from "../../shared/middleware/auth.js";
import { validateRequest } from "../../shared/middleware/validate-request.js";
import {
  categoryCreateBodySchema,
  categoryListQuerySchema,
  categoryParamsSchema,
  categoryUpdateBodySchema,
} from "./category.types.js";
import * as categoryController from "./category.controller.js";

export default async function categoryRoutes(
  app: FastifyInstance,
  _options: FastifyPluginOptions
): Promise<void> {
  app.get(
    "/",
    { preHandler: [validateRequest({ query: categoryListQuerySchema })] },
    categoryController.listCategories
  );

  app.get(
    "/:slug",
    { preHandler: [validateRequest({ params: categoryParamsSchema })] },
    categoryController.getCategoryBySlug
  );

  app.post(
    "/",
    {
      preHandler: [
        authenticate,
        authorize("ADMIN"),
        validateRequest({ body: categoryCreateBodySchema }),
      ],
    },
    categoryController.createCategory
  );

  app.patch(
    "/:slug",
    {
      preHandler: [
        authenticate,
        authorize("ADMIN"),
        validateRequest({ params: categoryParamsSchema, body: categoryUpdateBodySchema }),
      ],
    },
    categoryController.updateCategory
  );

  app.delete(
    "/:slug",
    {
      preHandler: [
        authenticate,
        authorize("ADMIN"),
        validateRequest({ params: categoryParamsSchema }),
      ],
    },
    categoryController.deleteCategory
  );
}
