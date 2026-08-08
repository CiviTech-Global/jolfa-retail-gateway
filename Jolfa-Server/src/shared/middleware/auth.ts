import type { FastifyReply, FastifyRequest, preHandlerHookHandler } from "fastify";
import type { UserRole } from "@prisma/client";
import { ForbiddenError, UnauthorizedError } from "../app-error.js";

export interface AuthenticatedUser {
  id: string;
  email: string;
  phone: string;
  role: UserRole;
}

export async function authenticate(req: FastifyRequest, _reply: FastifyReply): Promise<void> {
  try {
    await req.jwtVerify();
  } catch {
    throw new UnauthorizedError("توکن نامعتبر یا منقضی شده است");
  }
}

export function authorize(...allowedRoles: UserRole[]): preHandlerHookHandler {
  return async (req: FastifyRequest, _reply: FastifyReply): Promise<void> => {
    const user = req.user as AuthenticatedUser | undefined;
    if (!user) {
      throw new UnauthorizedError("ابتدا وارد حساب کاربری خود شوید");
    }

    if (!allowedRoles.includes(user.role)) {
      throw new ForbiddenError("شما دسترسی لازم برای این عملیات را ندارید");
    }
  };
}
