import type { FastifyInstance, FastifyPluginOptions, FastifyReply, FastifyRequest } from "fastify";
import { authenticate, authorize } from "../../shared/middleware/auth.js";
import { validateRequest } from "../../shared/middleware/validate-request.js";
import { sendSuccess } from "../../shared/reply.js";
import { asyncHandler } from "../../shared/async-handler.js";
import { searchAdmin } from "./admin-search.service.js";
import { bulkAdjustPrices } from "./bulk-price.service.js";
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

  app.post(
    "/products/bulk-price",
    { preHandler: [...adminPreHandler, validateRequest({ body: bulkPriceBodySchema })] },
    bulkPrice
  );
}
