import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import { authenticate } from "../../shared/middleware/auth.js";
import { validateRequest } from "../../shared/middleware/validate-request.js";
import * as addressController from "./address.controller.js";
import {
  addressCreateSchema,
  addressParamsSchema,
  addressUpdateSchema,
} from "./address.types.js";

/**
 * The signed-in user's address book. There is no admin surface: an address
 * belongs to its owner, and orders keep their own snapshot of one.
 */
export default async function addressRoutes(
  app: FastifyInstance,
  _options: FastifyPluginOptions
): Promise<void> {
  app.get("/", { preHandler: [authenticate] }, addressController.listAddresses);

  app.get(
    "/:id",
    { preHandler: [authenticate, validateRequest({ params: addressParamsSchema })] },
    addressController.getAddress
  );

  app.post(
    "/",
    { preHandler: [authenticate, validateRequest({ body: addressCreateSchema })] },
    addressController.createAddress
  );

  app.patch(
    "/:id",
    {
      preHandler: [
        authenticate,
        validateRequest({ params: addressParamsSchema, body: addressUpdateSchema }),
      ],
    },
    addressController.updateAddress
  );

  app.post(
    "/:id/default",
    { preHandler: [authenticate, validateRequest({ params: addressParamsSchema })] },
    addressController.setDefaultAddress
  );

  app.delete(
    "/:id",
    { preHandler: [authenticate, validateRequest({ params: addressParamsSchema })] },
    addressController.deleteAddress
  );
}
