import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import { authenticate, authorize } from "../../shared/middleware/auth.js";
import { validateRequest } from "../../shared/middleware/validate-request.js";
import {
  getActiveHomepageSections,
  getAllHomepageSections,
  createHomepageSection,
  updateHomepageSection,
  deleteHomepageSection,
} from "./homepage-section.controller.js";
import {
  homepageSectionCreateSchema,
  homepageSectionUpdateSchema,
  homepageSectionParamsSchema,
} from "./homepage-section.types.js";

const adminPreHandler = [authenticate, authorize("ADMIN")];

export default async function homepageSectionRoutes(
  app: FastifyInstance,
  _options: FastifyPluginOptions
): Promise<void> {
  app.get("/public", getActiveHomepageSections);

  app.get("/", { preHandler: adminPreHandler }, getAllHomepageSections);

  app.post(
    "/",
    {
      preHandler: [...adminPreHandler, validateRequest({ body: homepageSectionCreateSchema })],
    },
    createHomepageSection
  );

  app.patch(
    "/:id",
    {
      preHandler: [
        ...adminPreHandler,
        validateRequest({
          params: homepageSectionParamsSchema,
          body: homepageSectionUpdateSchema,
        }),
      ],
    },
    updateHomepageSection
  );

  app.delete(
    "/:id",
    {
      preHandler: [...adminPreHandler, validateRequest({ params: homepageSectionParamsSchema })],
    },
    deleteHomepageSection
  );
}
