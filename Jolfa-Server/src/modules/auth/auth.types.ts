import { z } from "zod";
import type { UserRole } from "@prisma/client";

export const registerSchema = z.object({
  email: z.string().email("ایمیل معتبر نیست").optional(),
  phone: z
    .string()
    .min(10, "شماره موبایل باید حداقل ۱۰ رقم باشد")
    .max(15, "شماره موبایل باید حداکثر ۱۵ رقم باشد"),
  password: z.string().min(6, "رمز عبور باید حداقل ۶ کاراکتر باشد"),
  firstName: z.string().max(100, "نام حداکثر ۱۰۰ کاراکتر").optional(),
  lastName: z.string().max(100, "نام خانوادگی حداکثر ۱۰۰ کاراکتر").optional(),
});

export const loginSchema = z
  .object({
    email: z.string().email("ایمیل معتبر نیست").optional(),
    phone: z
      .string()
      .min(10, "شماره موبایل باید حداقل ۱۰ رقم باشد")
      .max(15, "شماره موبایل باید حداکثر ۱۵ رقم باشد")
      .optional(),
    password: z.string().min(1, "رمز عبور الزامی است"),
  })
  .refine((data) => Boolean(data.email) || Boolean(data.phone), {
    message: "ایمیل یا شماره موبایل را وارد کنید",
    path: ["email"],
  });

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

export interface AuthUser {
  id: string;
  email: string | null;
  phone: string;
  firstName: string | null;
  lastName: string | null;
  role: UserRole;
  isActive: boolean;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResponse {
  user: AuthUser;
  tokens: AuthTokens;
}
