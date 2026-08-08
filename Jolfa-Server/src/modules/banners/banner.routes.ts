import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import { authenticate, authorize } from "../../shared/middleware/auth.js";
import { validateRequest } from "../../shared/middleware/validate-request.js";
import {
  bannerCreateBodySchema,
  bannerListQuerySchema,
  bannerParamsSchema,
  bannerUpdateBodySchema,
} from "./banner.types.js";
import * as bannerController from "./banner.controller.js";

export default async function bannerRoutes(
  app: FastifyInstance,
  _options: FastifyPluginOptions
): Promise<void> {
  // Public routes
  app.get(
    "/banners",
    { preHandler: [validateRequest({ query: bannerListQuerySchema })] },
    bannerController.listBanners
  );

  // Admin routes
  app.get(
    "/admin/banners",
    { preHandler: [authenticate, authorize("ADMIN")] },
    bannerController.listAllBanners
  );

  app.post(
    "/admin/banners",
    {
      preHandler: [
        authenticate,
        authorize("ADMIN"),
        validateRequest({ body: bannerCreateBodySchema }),
      ],
    },
    bannerController.createBanner
  );

  app.patch(
    "/admin/banners/:id",
    {
      preHandler: [
        authenticate,
        authorize("ADMIN"),
        validateRequest({ params: bannerParamsSchema, body: bannerUpdateBodySchema }),
      ],
    },
    bannerController.updateBanner
  );

  app.delete(
    "/admin/banners/:id",
    {
      preHandler: [
        authenticate,
        authorize("ADMIN"),
        validateRequest({ params: bannerParamsSchema }),
      ],
    },
    bannerController.deleteBanner
  );
}
