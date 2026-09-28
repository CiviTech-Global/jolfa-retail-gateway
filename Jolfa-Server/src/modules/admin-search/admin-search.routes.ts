import type { FastifyInstance, FastifyPluginOptions, FastifyReply, FastifyRequest } from "fastify";
import { authenticate, authorize } from "../../shared/middleware/auth.js";
import { validateRequest } from "../../shared/middleware/validate-request.js";
import { sendSuccess } from "../../shared/reply.js";
import { asyncHandler } from "../../shared/async-handler.js";
import { searchAdmin } from "./admin-search.service.js";
import * as productController from "../products/product.controller.js";
import { productListQuerySchema } from "../products/product.types.js";
import { bulkAdjustPrices, getLastBulkPriceRun } from "./bulk-price.service.js";
import { adminSearchQuerySchema, bulkPriceBodySchema } from "./admin-search.types.js";
import type { AdminSearchQuery, BulkPriceBody } from "./admin-search.types.js";

const adminPreHandler = [authenticate, authorize("ADMIN")];

const search = asyncHandler(
  async (
    request: FastifyRequest<{ Querystring: AdminSearchQuery }>,
    reply: FastifyReply
  ): Promise<void> => {
    sendSuccess(reply, await searchAdmin(request.query.q));
  }
);

const lastBulkPrice = asyncHandler(
  async (_request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    sendSuccess(reply, { lastRun: await getLastBulkPriceRun() });
  }
);

const bulkPrice = asyncHandler(
  async (
    request: FastifyRequest<{ Body: BulkPriceBody }>,
    reply: FastifyReply
  ): Promise<void> => {
    sendSuccess(reply, await bulkAdjustPrices(request.body, request.user.id));
  }
);

export default async function adminSearchRoutes(
  app: FastifyInstance,
  _options: FastifyPluginOptions
): Promise<void> {
  app.get(
    "/search",
    { preHandler: [...adminPreHandler, validateRequest({ query: adminSearchQuerySchema })] },
    search
  );

  // The catalogue listing for the admin panel. Same filters as the public
  // route plus `isActive`, which only has effect behind this guard.
  app.get(
    "/products",
    { preHandler: [...adminPreHandler, validateRequest({ query: productListQuerySchema })] },
    productController.listAdminProducts
  );

  // Registered before the POST so the two are easy to read together; Fastify
  // routes on method as well as path, so the order is not significant.
  app.get("/products/bulk-price/last", { preHandler: adminPreHandler }, lastBulkPrice);

  app.post(
    "/products/bulk-price",
    { preHandler: [...adminPreHandler, validateRequest({ body: bulkPriceBodySchema })] },
    bulkPrice
  );
}
