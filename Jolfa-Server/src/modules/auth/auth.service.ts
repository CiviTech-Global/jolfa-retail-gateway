import bcrypt from "bcrypt";
import type { FastifyInstance } from "fastify";
import type { UserRole } from "@prisma/client";
import { prisma } from "../../shared/prisma.js";
import { env } from "../../config/env.js";
import { BadRequestError, ConflictError, NotFoundError, UnauthorizedError } from "../../shared/app-error.js";
import { loginSchema, registerSchema } from "./auth.types.js";
import type { AuthResponse, AuthTokens, AuthUser, LoginInput, RegisterInput } from "./auth.types.js";

const USER_PUBLIC_SELECT = {
  id: true,
  email: true,
  phone: true,
  firstName: true,
  lastName: true,
  role: true,
  isActive: true,
} as const;

type PrismaUserPayload = {
  id: string;
  email: string | null;
  phone: string;
  firstName: string | null;
  lastName: string | null;
  role: UserRole;
  isActive: boolean;
};

export function generateTokens(user: PrismaUserPayload, app: FastifyInstance): AuthTokens {
  const payload = {
    id: user.id,
    email: user.email ?? "",
    phone: user.phone,
    role: user.role,
  };

  const accessToken = app.jwt.sign(payload, { expiresIn: env.JWT_ACCESS_EXPIRES_IN });
  const refreshToken = app.jwt.sign({ id: user.id }, { expiresIn: env.JWT_REFRESH_EXPIRES_IN });

  return { accessToken, refreshToken };
}

export async function register(data: RegisterInput, app: FastifyInstance): Promise<AuthResponse> {
  const parsed = registerSchema.parse(data);

  const existingUser = await prisma.user.findFirst({
    where: {
      OR: [{ phone: parsed.phone }, ...(parsed.email ? [{ email: parsed.email }] : [])],
    },
  });

  if (existingUser) {
    throw new ConflictError("کاربری با این ایمیل یا شماره موبایل قبلاً ثبت‌نام کرده است");
  }

  const passwordHash = await bcrypt.hash(parsed.password, 12);

  const user = await prisma.user.create({
    data: {
      email: parsed.email,
      phone: parsed.phone,
      passwordHash,
      firstName: parsed.firstName,
      lastName: parsed.lastName,
    },
    select: USER_PUBLIC_SELECT,
  });

  return { user, tokens: generateTokens(user, app) };
}

export async function login(data: LoginInput, app: FastifyInstance): Promise<AuthResponse> {
  const parsed = loginSchema.parse(data);

  if (!parsed.email && !parsed.phone) {
    throw new BadRequestError("ایمیل یا شماره موبایل را وارد کنید");
  }

  const user = await prisma.user.findFirst({
    where: {
      OR: [
        ...(parsed.email ? [{ email: parsed.email }] : []),
        ...(parsed.phone ? [{ phone: parsed.phone }] : []),
      ],
    },
    select: {
      ...USER_PUBLIC_SELECT,
      passwordHash: true,
    },
  });

  if (!user) {
    throw new UnauthorizedError("ایمیل/موبایل یا رمز عبور اشتباه است");
  }

  const { passwordHash, ...publicUser } = user;
  const validPassword = await bcrypt.compare(parsed.password, passwordHash);

  if (!validPassword) {
    throw new UnauthorizedError("ایمیل/موبایل یا رمز عبور اشتباه است");
  }

  if (!publicUser.isActive) {
    throw new UnauthorizedError("حساب کاربری شما غیرفعال است");
  }

  return { user: publicUser, tokens: generateTokens(publicUser, app) };
}

export async function getUserById(id: string): Promise<AuthUser> {
  const user = await prisma.user.findUnique({
    where: { id },
    select: USER_PUBLIC_SELECT,
  });

  if (!user) {
    throw new NotFoundError("User");
  }

  return user;
}
