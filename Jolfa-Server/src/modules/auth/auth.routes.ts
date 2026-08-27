import type { FastifyInstance } from "fastify";
import { env } from "../../config/env.js";
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
  refreshController,
  logoutController,
} from "./auth.controller.js";
import {
  changePasswordSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  updateProfileSchema,
  refreshSchema,
} from "./auth.types.js";
import type { RefreshInput } from "./auth.types.js";

/**
 * Tighter than the global bucket. These five routes are the ones worth
 * attacking: four accept credentials, and `/forgot-password` spends real money
 * on an SMS for every request it accepts.
 */
const authRateLimit = {
  rateLimit: {
    max: env.AUTH_RATE_LIMIT_MAX,
    timeWindow: env.AUTH_RATE_LIMIT_WINDOW,
  },
};

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post("/register", { config: authRateLimit }, registerController(app));
  app.post("/login", { config: authRateLimit }, loginController(app));
  // Rate-limited like the other credential routes: a refresh token is a
  // credential, and this endpoint mints new ones.
  app.post<{ Body: RefreshInput }>(
    "/refresh",
    { config: authRateLimit, preHandler: [validateRequest({ body: refreshSchema })] },
    refreshController(app),
  );

  app.post("/logout", { preHandler: [authenticate] }, logoutController);

  app.get("/me", { preHandler: [authenticate] }, meController);

  app.patch(
    "/me",
    { preHandler: [authenticate, validateRequest({ body: updateProfileSchema })] },
    updateProfileController,
  );

  app.post(
    "/change-password",
    { config: authRateLimit, preHandler: [authenticate, validateRequest({ body: changePasswordSchema })] },
    changePasswordController,
  );

  // Unauthenticated by design — the caller has lost access to their account.
  app.post(
    "/forgot-password",
    { config: authRateLimit, preHandler: [validateRequest({ body: forgotPasswordSchema })] },
    forgotPasswordController,
  );

  app.post(
    "/reset-password",
    { config: authRateLimit, preHandler: [validateRequest({ body: resetPasswordSchema })] },
    resetPasswordController,
  );
}
