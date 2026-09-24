import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import { authenticate, authorize } from "../../shared/middleware/auth.js";
import { validateRequest } from "../../shared/middleware/validate-request.js";
import {
  getContentPage,
  listContentPages,
  updateContentPage,
} from "./content-page.controller.js";
import { contentPageParamsSchema, contentPageUpdateSchema } from "./content-page.types.js";

const adminPreHandler = [authenticate, authorize("ADMIN")];

export default async function contentPageRoutes(
  app: FastifyInstance,
  _options: FastifyPluginOptions
): Promise<void> {
  // Public: every visitor of /about reads this. No auth, no publish flag —
  // whether the page is reachable at all is the `show_about` setting's job,
  // which already gates the route and the navigation links.
  app.get(
    "/public/:slug",
    { preHandler: [validateRequest({ params: contentPageParamsSchema })] },
    getContentPage
  );

  app.get("/", { preHandler: adminPreHandler }, listContentPages);

  app.get(
    "/:slug",
    { preHandler: [...adminPreHandler, validateRequest({ params: contentPageParamsSchema })] },
    getContentPage
  );

  app.patch(
    "/:slug",
    {
      preHandler: [
        ...adminPreHandler,
        validateRequest({ params: contentPageParamsSchema, body: contentPageUpdateSchema }),
      ],
    },
    updateContentPage
  );
}
