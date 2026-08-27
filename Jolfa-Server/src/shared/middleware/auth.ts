import type { FastifyReply, FastifyRequest, preHandlerHookHandler } from "fastify";
import type { UserRole } from "@prisma/client";
import { ForbiddenError, UnauthorizedError } from "../app-error.js";
import { prisma } from "../prisma.js";

export interface AuthenticatedUser {
  id: string;
  email: string;
  phone: string;
  role: UserRole;
  /** Token version the credential was issued at. */
  tv?: number;
  /** "access" or "refresh". Refresh tokens must not authenticate a request. */
  typ?: string;
}

export async function authenticate(req: FastifyRequest, _reply: FastifyReply): Promise<void> {
  try {
    await req.jwtVerify();
  } catch {
    throw new UnauthorizedError("توکن نامعتبر یا منقضی شده است");
  }

  const user = req.user as AuthenticatedUser | undefined;
  if (!user) {
    throw new UnauthorizedError("توکن نامعتبر یا منقضی شده است");
  }

  // A refresh token is signed with the same key, so without this check it would
  // authenticate any endpoint — defeating the point of the shorter access token.
  if (user.typ !== "access") {
    throw new UnauthorizedError("توکن نامعتبر یا منقضی شده است");
  }

  // One indexed lookup per authenticated request, in exchange for being able to
  // end a session immediately instead of waiting for the token to expire.
  const current = await prisma.user.findUnique({
    where: { id: user.id },
    select: { tokenVersion: true, isActive: true },
  });

  if (!current || !current.isActive) {
    throw new UnauthorizedError("حساب کاربری در دسترس نیست");
  }

  if ((user.tv ?? 0) !== current.tokenVersion) {
    throw new UnauthorizedError("این نشست منقضی شده است. دوباره وارد شوید");
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
