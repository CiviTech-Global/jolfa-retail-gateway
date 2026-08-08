import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import { authenticate, authorize } from "../../shared/middleware/auth.js";
import { validateRequest } from "../../shared/middleware/validate-request.js";
import { runDemoAction } from "./demo.controller.js";
import { demoActionSchema } from "./demo.types.js";

export default async function demoRoutes(
  app: FastifyInstance,
  _options: FastifyPluginOptions
): Promise<void> {
  app.post(
    "/",
    {
      preHandler: [
        authenticate,
        authorize("ADMIN"),
        validateRequest({ body: demoActionSchema }),
      ],
    },
    runDemoAction
  );
}
