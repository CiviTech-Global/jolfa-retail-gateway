import type { FastifyInstance } from "fastify";
import { authenticate } from "../../shared/middleware/auth.js";
import { registerController, loginController, meController } from "./auth.controller.js";

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post("/register", registerController(app));
  app.post("/login", loginController(app));
  app.get("/me", { preHandler: [authenticate] }, meController);
}
