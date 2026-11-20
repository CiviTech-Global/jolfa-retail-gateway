import { prisma } from "../../shared/prisma.js";
import { env } from "../../config/env.js";
import { AppError } from "../../shared/app-error.js";
import { logAudit } from "../../shared/audit/audit.service.js";
import { logger } from "../../shared/logger.js";
import { isTorobPayConfigured, torobPayClientHint } from "./torobpay.client.js";

/**
 * Whether customers are offered TorobPay at checkout.
 *
 * Kept in the database, like the Zibal live/sandbox switch, so the shop owner
 * can take the option away the moment something looks wrong with it — without
 * a deploy — and so every change has an author and a time in the audit log.
 *
 * Read per request rather than cached: the API runs as two PM2 workers, and a
 * flag flipped on one must not leave the other offering a gateway the owner
 * just switched off.
 */
export const TOROBPAY_ENABLED_KEY = "torobpay_enabled";

/** True only when switched on AND every credential is present. */
export async function isTorobPayEnabled(): Promise<boolean> {
  if (!isTorobPayConfigured()) return false;
  const row = await prisma.setting.findUnique({
    where: { key: TOROBPAY_ENABLED_KEY },
    select: { value: true },
  });
  // No row means never switched on: a new gateway starts off.
  return row?.value === "true";
}

export interface TorobPayAdminStatus {
  enabled: boolean;
  configured: boolean;
  clientHint: string | null;
  /** Where TorobPay posts the customer back. Sent with every payment; nothing to register. */
  returnUrl: string;
  canEnable: boolean;
  blockedReason: string | null;
}

export function torobPayReturnUrl(): string {
  return `${env.APP_URL}${env.API_PREFIX}/payments/callback/torobpay`;
}

export async function getTorobPayAdminStatus(): Promise<TorobPayAdminStatus> {
  const configured = isTorobPayConfigured();
  return {
    enabled: await isTorobPayEnabled(),
    configured,
    clientHint: torobPayClientHint(),
    returnUrl: torobPayReturnUrl(),
    canEnable: configured,
    blockedReason: configured
      ? null
      : "اطلاعات پذیرندگی ترب‌پی (شناسه، کلید، نام کاربری و رمز عبور) روی سرور تنظیم نشده است.",
  };
}

export async function setTorobPayEnabled(
  enabled: boolean,
  actorId: string,
): Promise<TorobPayAdminStatus> {
  if (enabled && !isTorobPayConfigured()) {
    throw new AppError(
      "برای فعال‌سازی ترب‌پی، اطلاعات پذیرندگی آن باید روی سرور تنظیم شده باشد.",
      400,
      "TOROBPAY_NOT_CONFIGURED",
    );
  }

  const previous = await isTorobPayEnabled();
  const value = enabled ? "true" : "false";

  const setting = await prisma.setting.upsert({
    where: { key: TOROBPAY_ENABLED_KEY },
    update: { value },
    create: {
      key: TOROBPAY_ENABLED_KEY,
      value,
      group: "payments",
      isPublic: false,
      description: "TorobPay instalment payments are offered at checkout when true",
    },
  });

  if (previous !== enabled) {
    logger.warn({ actorId, enabled, previous }, `torobpay switched ${enabled ? "ON" : "OFF"}`);
  }

  await logAudit({
    userId: actorId,
    action: "UPDATE",
    entityType: "Setting",
    entityId: setting.id,
    metadata: {
      setting: TOROBPAY_ENABLED_KEY,
      before: previous ? "on" : "off",
      after: enabled ? "on" : "off",
    },
  });

  return getTorobPayAdminStatus();
}
