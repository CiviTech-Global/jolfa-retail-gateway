import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { sendSuccess } from "../../shared/reply.js";
import { asyncHandler } from "../../shared/async-handler.js";
import * as authService from "./auth.service.js";
import * as passwordService from "./password.service.js";
import type {
  ChangePasswordInput,
  ForgotPasswordInput,
  LoginInput,
  RefreshInput,
  RegisterInput,
  ResetPasswordInput,
  UpdateProfileInput,
} from "./auth.types.js";

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

export function refreshController(app: FastifyInstance) {
  return async (
    request: FastifyRequest<{ Body: RefreshInput }>,
    reply: FastifyReply,
  ): Promise<void> => {
    const result = await authService.refreshSession(request.body.refreshToken, app);
    sendSuccess(reply, result);
  };
}

export const logoutController = asyncHandler(
  async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    await authService.revokeSessions(request.user.id);
    sendSuccess(reply, { message: "از حساب کاربری خارج شدید" });
  },
);

export async function meController(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const user = await authService.getUserById(request.user.id);
  sendSuccess(reply, { user });
}

// --- Credential management -------------------------------------------------

export const changePasswordController = asyncHandler(async (
  request: FastifyRequest<{ Body: ChangePasswordInput }>,
  reply: FastifyReply,
): Promise<void> => {
  await passwordService.changeOwnPassword(
    request.user.id,
    request.body.currentPassword,
    request.body.newPassword,
  );
  sendSuccess(reply, { message: "رمز عبور با موفقیت تغییر کرد" });
});

export const forgotPasswordController = asyncHandler(async (
  request: FastifyRequest<{ Body: ForgotPasswordInput }>,
  reply: FastifyReply,
): Promise<void> => {
  const result = await passwordService.requestPasswordReset(request.body.phone);
  // The message and status are identical whether or not the phone is
  // registered, so this endpoint cannot be used to enumerate accounts.
  // Caveat: with NO SMS provider configured, `devCode` is present only for a
  // real account, which does distinguish the two. That is a local-development
  // affordance only — configure a provider and the field never appears.
  sendSuccess(reply, {
    message: "اگر این شماره در سیستم ثبت شده باشد، کد بازیابی ارسال می‌شود.",
    delivered: result.delivered,
    ...(result.devCode ? { devCode: result.devCode } : {}),
  });
});

export const resetPasswordController = asyncHandler(async (
  request: FastifyRequest<{ Body: ResetPasswordInput }>,
  reply: FastifyReply,
): Promise<void> => {
  await passwordService.resetPasswordWithCode(
    request.body.phone,
    request.body.code,
    request.body.newPassword,
  );
  sendSuccess(reply, { message: "رمز عبور بازیابی شد. اکنون وارد شوید." });
});

export const updateProfileController = asyncHandler(async (
  request: FastifyRequest<{ Body: UpdateProfileInput }>,
  reply: FastifyReply,
): Promise<void> => {
  const user = await passwordService.updateOwnProfile(request.user.id, request.body);
  sendSuccess(reply, { user });
});
