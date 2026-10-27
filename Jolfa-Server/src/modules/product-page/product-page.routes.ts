import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import { validateRequest } from "../../shared/middleware/validate-request.js";
import { productParamsSchema } from "../products/product.types.js";
import * as productPageController from "./product-page.controller.js";

/**
 * The storefront's product URL, answered as HTML. Mounted at the root rather
 * than under the API prefix, because this is the address crawlers and shoppers
 * actually open; nginx routes only this path here and serves every other page
 * as the static shell.
 */
export default async function productPageRoutes(
  app: FastifyInstance,
  _options: FastifyPluginOptions,
): Promise<void> {
  app.get(
    "/products/:slug",
    {
      // Helmet's policy is written for JSON (`script-src 'none'`) and would
      // stop the app from loading. nginx adds the same security headers here
      // as on every other page.
      helmet: false,
      // Torob crawls the whole catalogue from a few addresses; the API's
      // per-IP bucket would start refusing it part-way. nginx still limits
      // this path.
      config: { rateLimit: false },
      preHandler: [validateRequest({ params: productParamsSchema })],
    },
    productPageController.getProductPage,
  );
}
