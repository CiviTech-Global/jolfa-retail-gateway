import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import { validateRequest } from "../../shared/middleware/validate-request.js";
import * as emallsController from "./emalls.controller.js";
import { emallsQuerySchema } from "./emalls.types.js";

/**
 * Product feeds read by price-comparison sites. Public, and read-only: they
 * expose nothing the product pages do not.
 */
export default async function feedRoutes(
  app: FastifyInstance,
  _options: FastifyPluginOptions,
): Promise<void> {
  // Emalls may POST, and its parameters arrive in the query string either way.
  // Whatever body it sends is ignored: left to Fastify's defaults, an empty
  // JSON body would answer 400 and a form body 415, and the feed would fail
  // with no fault in the data.
  app.removeAllContentTypeParsers();
  app.addContentTypeParser("*", (_request, _payload, done) => done(null, undefined));

  app.route({
    method: ["GET", "POST"],
    url: "/emalls",
    // A crawler walking the catalogue is not a shopper; the per-IP bucket is
    // not for it. nginx still limits this path.
    config: { rateLimit: false },
    preHandler: [validateRequest({ query: emallsQuerySchema })],
    handler: emallsController.getEmallsProducts,
  });
}
