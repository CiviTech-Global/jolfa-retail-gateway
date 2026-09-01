import type { FastifyRequest, FastifyReply } from "fastify";
import { asyncHandler } from "../../shared/async-handler.js";
import { listUsers, updateUserRole, updateUserStatus } from "./user.service.js";
import { adminResetUserPassword } from "../auth/password.service.js";
import type {
  UserListQuery,
  UserRoleUpdateBody,
  UserStatusUpdateBody,
  UserParams,
} from "./user.types.js";

export const listUsersController = asyncHandler(
  async (request: FastifyRequest<{ Querystring: UserListQuery }>, reply: FastifyReply) => {
    const data = await listUsers(request.query);
    return reply.status(200).send({ success: true, data });
  },
);

export const updateUserRoleController = asyncHandler(
  async (
    request: FastifyRequest<{ Params: UserParams; Body: UserRoleUpdateBody }>,
    reply: FastifyReply,
  ) => {
    const user = await updateUserRole(request.params.id, request.body, request.user?.id);
    return reply.status(200).send({ success: true, data: { user } });
  },
);

export const updateUserStatusController = asyncHandler(
  async (
    request: FastifyRequest<{ Params: UserParams; Body: UserStatusUpdateBody }>,
    reply: FastifyReply,
  ) => {
    const user = await updateUserStatus(request.params.id, request.body, request.user?.id);
    return reply.status(200).send({ success: true, data: { user } });
  },
);

export const resetUserPasswordController = asyncHandler(
  async (
    request: FastifyRequest<{ Params: UserParams; Body: { newPassword: string } }>,
    reply: FastifyReply,
  ) => {
    await adminResetUserPassword(request.params.id, request.body.newPassword, request.user!.id);
    return reply
      .status(200)
      .send({ success: true, data: { message: "رمز عبور کاربر تغییر کرد" } });
  },
);
