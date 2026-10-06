import bcrypt from "bcrypt";
import { randomInt, timingSafeEqual } from "node:crypto";
import { prisma } from "../../shared/prisma.js";
import { AppError, NotFoundError, UnauthorizedError } from "../../shared/app-error.js";
import { notify } from "../../shared/sms/notification.service.js";
import { resolveSiteName } from "../../shared/sms/site-name.js";
import { isSmsIrConfigured } from "../../shared/sms/smsir.client.js";
import { logAudit } from "../../shared/audit/audit.service.js";

const BCRYPT_ROUNDS = 12;
const OTP_TTL_MINUTES = 10;
const OTP_MAX_ATTEMPTS = 5;
/** Throttle: one code per this window, so the endpoint can't be used to spam. */
const OTP_RESEND_SECONDS = 60;

function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

/** 6-digit code from a CSPRNG — `Math.random()` is predictable. */
function generateOtp(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export async function changeOwnPassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, passwordHash: true },
  });
  if (!user) {
    throw new NotFoundError("User");
  }

  const matches = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!matches) {
    throw new UnauthorizedError("رمز عبور فعلی درست نیست");
  }

  if (await bcrypt.compare(newPassword, user.passwordHash)) {
    throw new AppError("رمز عبور جدید نباید با رمز فعلی یکسان باشد", 400, "SAME_PASSWORD");
  }

  await prisma.user.update({
    where: { id: user.id },
    // Changing the password ends every other session — the whole point of
    // changing it is usually that someone else may hold the old one.
    data: { passwordHash: await hashPassword(newPassword), tokenVersion: { increment: 1 } },
  });

  await logAudit({
    userId: user.id,
    action: "UPDATE",
    entityType: "User",
    entityId: user.id,
    metadata: { field: "password", by: "self" },
  });
}

/** Admin-initiated reset. Does not require the user's current password. */
export async function adminResetUserPassword(
  targetUserId: string,
  newPassword: string,
  actorId: string,
): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { id: true, phone: true },
  });
  if (!user) {
    throw new NotFoundError("User");
  }

  await prisma.user.update({
    where: { id: user.id },
    // Changing the password ends every other session — the whole point of
    // changing it is usually that someone else may hold the old one.
    data: { passwordHash: await hashPassword(newPassword), tokenVersion: { increment: 1 } },
  });

  // Any outstanding reset codes are void once the password changes.
  await prisma.passwordResetToken.updateMany({
    where: { userId: user.id, consumedAt: null },
    data: { consumedAt: new Date() },
  });

  await logAudit({
    userId: actorId,
    action: "UPDATE",
    entityType: "User",
    entityId: user.id,
    metadata: { field: "password", by: "admin" },
  });

  // Wording and the on/off switch now live in the admin panel, so the shop
  // owner can reword or silence this without a deploy.
  await notify({
    event: "password_changed_by_admin",
    userId: user.id,
    phone: user.phone,
    variables: { siteName: await resolveSiteName() },
  });
}

export interface RequestResetResult {
  /** False when no SMS provider is configured (code was logged instead). */
  delivered: boolean;
  /** Only populated when SMS is unconfigured, so local testing can proceed. */
  devCode?: string;
}

/**
 * Starts a reset. Always resolves the same way whether or not the phone
 * exists — a differing response would let anyone enumerate registered numbers.
 */
export async function requestPasswordReset(phone: string): Promise<RequestResetResult> {
  const user = await prisma.user.findUnique({
    where: { phone },
    select: { id: true, phone: true, isActive: true },
  });

  if (!user || !user.isActive) {
    // Mirrors what a real send would report, so the response cannot be used
    // to tell a registered number from an unregistered one.
    return { delivered: isSmsIrConfigured() };
  }

  const recent = await prisma.passwordResetToken.findFirst({
    where: {
      userId: user.id,
      consumedAt: null,
      createdAt: { gt: new Date(Date.now() - OTP_RESEND_SECONDS * 1000) },
    },
    select: { id: true },
  });
  if (recent) {
    throw new AppError(
      `برای دریافت کد جدید ${OTP_RESEND_SECONDS} ثانیه صبر کنید`,
      429,
      "OTP_THROTTLED",
    );
  }

  // Supersede any earlier unconsumed codes so only the newest one works.
  await prisma.passwordResetToken.updateMany({
    where: { userId: user.id, consumedAt: null },
    data: { consumedAt: new Date() },
  });

  const code = generateOtp();
  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      codeHash: await bcrypt.hash(code, BCRYPT_ROUNDS),
      expiresAt: new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000),
    },
  });

  /*
   * Sent through SMS.ir's VERIFY method — a template registered on their panel,
   * delivered from a service line.
   *
   * This replaced a free-text send, and the difference matters: a service line
   * arrives within seconds and reaches customers who have blocked advertising
   * SMS, whereas the previous free-text route did not. Those customers could
   * never complete a password reset, and nothing in our records said why —
   * the old code treated any HTTP 200 as delivered.
   *
   * The code's wording lives on SMS.ir's panel, so it is not editable here.
   */
  const result = await notify({
    event: "password_reset_otp",
    userId: user.id,
    phone: user.phone,
    variables: { code },
  });

  return {
    delivered: result.outcome === "sent",
    // Returned ONLY when no provider is configured at all, i.e. local
    // development. Never when a send was attempted and failed.
    ...(result.outcome === "not_configured" ? { devCode: code } : {}),
  };
}

export async function resetPasswordWithCode(
  phone: string,
  code: string,
  newPassword: string,
): Promise<void> {
  const invalid = new AppError("کد وارد شده معتبر نیست یا منقضی شده است", 400, "INVALID_OTP");

  const user = await prisma.user.findUnique({
    where: { phone },
    select: { id: true, isActive: true },
  });
  if (!user || !user.isActive) {
    throw invalid;
  }

  const token = await prisma.passwordResetToken.findFirst({
    where: { userId: user.id, consumedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
  if (!token) {
    throw invalid;
  }

  if (token.attempts >= OTP_MAX_ATTEMPTS) {
    // Burn it rather than allowing unlimited guesses against a 6-digit code.
    await prisma.passwordResetToken.update({
      where: { id: token.id },
      data: { consumedAt: new Date() },
    });
    throw new AppError("تعداد تلاش‌ها بیش از حد مجاز است. کد جدیدی درخواست کنید.", 429, "OTP_ATTEMPTS_EXCEEDED");
  }

  const matches = await bcrypt.compare(code, token.codeHash);
  if (!matches) {
    await prisma.passwordResetToken.update({
      where: { id: token.id },
      data: { attempts: { increment: 1 } },
    });
    throw invalid;
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      // Changing the password ends every other session — the whole point of
    // changing it is usually that someone else may hold the old one.
    data: { passwordHash: await hashPassword(newPassword), tokenVersion: { increment: 1 } },
    }),
    prisma.passwordResetToken.update({
      where: { id: token.id },
      data: { consumedAt: new Date() },
    }),
  ]);

  await logAudit({
    userId: user.id,
    action: "UPDATE",
    entityType: "User",
    entityId: user.id,
    metadata: { field: "password", by: "otp-reset" },
  });
}

/** Profile fields a user may edit about themselves. */
export async function updateOwnProfile(
  userId: string,
  data: { firstName?: string | null; lastName?: string | null; email?: string | null },
) {
  const existing = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!existing) {
    throw new NotFoundError("User");
  }

  if (data.email) {
    const clash = await prisma.user.findUnique({
      where: { email: data.email },
      select: { id: true },
    });
    if (clash && clash.id !== userId) {
      throw new AppError("این ایمیل قبلاً استفاده شده است", 409, "EMAIL_TAKEN");
    }
  }

  return prisma.user.update({
    where: { id: userId },
    data,
    select: {
      id: true,
      email: true,
      phone: true,
      firstName: true,
      lastName: true,
      role: true,
      isActive: true,
    },
  });
}

/** Exported for tests: constant-time compare helper for future token work. */
export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}
