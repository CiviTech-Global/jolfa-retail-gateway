import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { sendSuccess } from "../../shared/reply.js";
import * as authService from "./auth.service.js";
import type { LoginInput, RegisterInput } from "./auth.types.js";

export function registerController(app: FastifyInstance) {
  return async (request: FastifyRequest<{ Body: RegisterInput }>, reply: FastifyReply): Promise<void> => {
    const result = await authService.register(request.body, app);
    sendSuccess(reply, result, 201);
  };
}

export function loginController(app: FastifyInstance) {
  return async (request: FastifyRequest<{ Body: LoginInput }>, reply: FastifyReply): Promise<void> => {
    const result = await authService.login(request.body, app);
    sendSuccess(reply, result);
  };
}

export async function meController(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const user = await authService.getUserById(request.user.id);
  sendSuccess(reply, { user });
}
