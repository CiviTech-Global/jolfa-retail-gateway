import type { FastifyInstance } from "fastify";
import { authenticate } from "../../shared/middleware/auth.js";
import { validateRequest } from "../../shared/middleware/validate-request.js";
import {
  registerController,
  loginController,
  meController,
  changePasswordController,
  forgotPasswordController,
  resetPasswordController,
  updateProfileController,
} from "./auth.controller.js";
import {
  changePasswordSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  updateProfileSchema,
} from "./auth.types.js";

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post("/register", registerController(app));
  app.post("/login", loginController(app));
  app.get("/me", { preHandler: [authenticate] }, meController);

  app.patch(
    "/me",
    { preHandler: [authenticate, validateRequest({ body: updateProfileSchema })] },
    updateProfileController,
  );

  app.post(
    "/change-password",
    { preHandler: [authenticate, validateRequest({ body: changePasswordSchema })] },
    changePasswordController,
  );

  // Unauthenticated by design — the caller has lost access to their account.
  app.post(
    "/forgot-password",
    { preHandler: [validateRequest({ body: forgotPasswordSchema })] },
    forgotPasswordController,
  );

  app.post(
    "/reset-password",
    { preHandler: [validateRequest({ body: resetPasswordSchema })] },
    resetPasswordController,
  );
}
