import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import { authenticate, authorize } from "../../shared/middleware/auth.js";
import { validateRequest } from "../../shared/middleware/validate-request.js";
import {
  createDiscountCode,
  deleteDiscountCode,
  listDiscountCodes,
  previewDiscountCode,
  updateDiscountCode,
} from "./discount.service.js";
import {
  discountCodeBodySchema,
  discountCodeParamsSchema,
  discountValidateBodySchema,
  type DiscountCodeBody,
  type DiscountValidateBody,
} from "./discount.types.js";

/** Customer side, mounted at /discount-codes. */
export default async function discountRoutes(
  app: FastifyInstance,
  _options: FastifyPluginOptions,
): Promise<void> {
  // Signed-in only: per-customer limits need to know who is asking, and an
  // open endpoint would let anyone enumerate the shop's codes.
  app.post(
    "/validate",
    {
      preHandler: [authenticate, validateRequest({ body: discountValidateBodySchema })],
      // Tighter than the global bucket: this is the one route that answers
      // "is this string a code?".
      config: { rateLimit: { max: 20, timeWindow: "1 minute" } },
    },
    async (request, reply) => {
      const body = request.body as DiscountValidateBody;
      const data = await previewDiscountCode({ ...body, userId: request.user.id });
      return reply.status(200).send({ success: true, data });
    },
  );
}

/** Admin side, mounted at /admin. */
export async function discountAdminRoutes(
  app: FastifyInstance,
  _options: FastifyPluginOptions,
): Promise<void> {
  const admin = [authenticate, authorize("ADMIN")];

  app.get("/discount-codes", { preHandler: admin }, async (_request, reply) => {
    return reply.status(200).send({ success: true, data: await listDiscountCodes() });
  });

  app.post(
    "/discount-codes",
    { preHandler: [...admin, validateRequest({ body: discountCodeBodySchema })] },
    async (request, reply) => {
      const data = await createDiscountCode(request.body as DiscountCodeBody, request.user.id);
      return reply.status(201).send({ success: true, data });
    },
  );

  app.put(
    "/discount-codes/:id",
    {
      preHandler: [
        ...admin,
        validateRequest({ params: discountCodeParamsSchema, body: discountCodeBodySchema }),
      ],
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const data = await updateDiscountCode(id, request.body as DiscountCodeBody, request.user.id);
      return reply.status(200).send({ success: true, data });
    },
  );

  app.delete(
    "/discount-codes/:id",
    { preHandler: [...admin, validateRequest({ params: discountCodeParamsSchema })] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const data = await deleteDiscountCode(id, request.user.id);
      return reply.status(200).send({ success: true, data });
    },
  );
}
