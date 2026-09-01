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

// --- Credential management -------------------------------------------------

const passwordField = z
  .string({ required_error: "رمز عبور الزامی است" })
  .min(6, "رمز عبور باید حداقل ۶ کاراکتر باشد")
  .max(72, "رمز عبور حداکثر ۷۲ کاراکتر است");

const phoneField = z
  .string({ required_error: "شماره موبایل الزامی است" })
  .trim()
  .regex(/^09\d{9}$/, "شماره موبایل باید با ۰۹ شروع شود و ۱۱ رقم باشد");

export const changePasswordSchema = z
  .object({
    currentPassword: z.string({ required_error: "رمز عبور فعلی الزامی است" }).min(1, "رمز عبور فعلی الزامی است"),
    newPassword: passwordField,
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    path: ["newPassword"],
    message: "رمز عبور جدید نباید با رمز فعلی یکسان باشد",
  });

export const forgotPasswordSchema = z.object({
  phone: phoneField,
});

export const resetPasswordSchema = z.object({
  phone: phoneField,
  code: z
    .string({ required_error: "کد تأیید الزامی است" })
    .trim()
    .regex(/^\d{6}$/, "کد تأیید باید ۶ رقم باشد"),
  newPassword: passwordField,
});

export const updateProfileSchema = z.object({
  firstName: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? null : v),
    z.string().trim().max(100, "نام حداکثر ۱۰۰ کاراکتر است").nullish(),
  ),
  lastName: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? null : v),
    z.string().trim().max(100, "نام خانوادگی حداکثر ۱۰۰ کاراکتر است").nullish(),
  ),
  email: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? null : v),
    z.string().trim().email("ایمیل معتبر نیست").max(255).nullish(),
  ),
});

export const adminResetPasswordSchema = z.object({
  newPassword: passwordField,
});

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type AdminResetPasswordInput = z.infer<typeof adminResetPasswordSchema>;

/** Body of POST /auth/refresh. Exported for the route's validateRequest. */
export const refreshSchema = z.object({
  refreshToken: z.string().min(1, "توکن تازه‌سازی الزامی است"),
});

export type RefreshInput = z.infer<typeof refreshSchema>;
