import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import { authenticate, authorize } from "../../shared/middleware/auth.js";
import { validateRequest } from "../../shared/middleware/validate-request.js";
import * as settingsController from "./settings.controller.js";
import { settingParamsSchema, settingUpdateSchema } from "./settings.types.js";

export default async function settingsRoutes(
  app: FastifyInstance,
  _options: FastifyPluginOptions
): Promise<void> {
  app.get("/public", settingsController.listPublicSettings);

  app.get(
    "/",
    { preHandler: [authenticate, authorize("ADMIN")] },
    settingsController.listAllSettings
  );

  app.patch(
    "/:key",
    {
      preHandler: [
        authenticate,
        authorize("ADMIN"),
        validateRequest({ params: settingParamsSchema, body: settingUpdateSchema }),
      ],
    },
    settingsController.updateSetting
  );
}
