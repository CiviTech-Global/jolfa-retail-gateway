import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import { authenticate, authorize } from "../../shared/middleware/auth.js";
import { validateRequest } from "../../shared/middleware/validate-request.js";
import {
  listUsersController,
  updateUserRoleController,
  updateUserStatusController,
} from "./user.controller.js";
import {
  userListQuerySchema,
  userParamsSchema,
  userRoleUpdateSchema,
  userStatusUpdateSchema,
} from "./user.types.js";

export default async function userRoutes(
  app: FastifyInstance,
  _options: FastifyPluginOptions,
): Promise<void> {
  const adminPreHandler = [authenticate, authorize("ADMIN")];

  app.get(
    "/users",
    { preHandler: [...adminPreHandler, validateRequest({ query: userListQuerySchema })] },
    listUsersController,
  );

  app.patch(
    "/users/:id/role",
    {
      preHandler: [
        ...adminPreHandler,
        validateRequest({ params: userParamsSchema, body: userRoleUpdateSchema }),
      ],
    },
    updateUserRoleController,
  );

  app.patch(
    "/users/:id/status",
    {
      preHandler: [
        ...adminPreHandler,
        validateRequest({ params: userParamsSchema, body: userStatusUpdateSchema }),
      ],
    },
    updateUserStatusController,
  );
}
