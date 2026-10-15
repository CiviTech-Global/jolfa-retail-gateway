import { prisma } from "../../shared/prisma.js";
import { env } from "../../config/env.js";
import { AppError } from "../../shared/app-error.js";
import { logAudit } from "../../shared/audit/audit.service.js";
import { logger } from "../../shared/logger.js";

/**
 * Whether real money moves, and who is allowed to change that.
 *
 * This used to be `ZIBAL_SANDBOX` in the environment, which meant going live
 * required an Ansible run and a deploy. The shop owner needs to be able to do
 * it — and, more importantly, to undo it — without one, so the switch lives in
 * the database and is read on each payment.
 *
 * Read per request rather than cached: the API runs as two PM2 cluster workers,
 * so a cached flag flipped on one worker would leave the other taking payments
 * in the opposite mode until the next restart. One indexed lookup on a
 * checkout is not worth that.
 */

export const PAYMENT_LIVE_MODE_KEY = "payment_live_mode";

/**
 * Zibal's documented test merchant. Sending the literal string `zibal` puts the
 * gateway in sandbox: a real payment page is shown but no money moves.
 *
 * There is no separate sandbox hostname — the host is the same in both modes,
 * and only this value decides whether a payment is real.
 */
export const ZIBAL_SANDBOX_MERCHANT = "zibal";

/** The merchant id configured for real payments, if there is a usable one. */
function configuredMerchant(): string | null {
  const merchant = env.ZIBAL_MERCHANT_ID?.trim();
  if (!merchant) return null;
  // A merchant id of literally "zibal" is the sandbox merchant. Accepting it as
  // a live one would produce a shop that reports itself live and still moves no
  // money — the most expensive kind of silent failure here.
  if (merchant === ZIBAL_SANDBOX_MERCHANT) return null;
  return merchant;
}

export async function isLiveMode(): Promise<boolean> {
  const row = await prisma.setting.findUnique({
    where: { key: PAYMENT_LIVE_MODE_KEY },
    select: { value: true },
  });

  // No row yet — a database not seeded since this shipped. Fall back to the
  // environment flag of whichever gateway is configured, so behaviour does not
  // change under anyone's feet, and so an unset flag still means sandbox.
  if (!row) {
    return env.ZIBAL_MERCHANT_ID
      ? env.ZIBAL_SANDBOX === "false"
      : env.ZARINPAL_SANDBOX === "false";
  }

  return row.value === "true";
}

export async function isSandboxMode(): Promise<boolean> {
  return !(await isLiveMode());
}

export interface PaymentModeStatus {
  live: boolean;
  /** Which gateway the mode applies to. */
  gateway: "ZIBAL" | "ZARINPAL";
  merchantConfigured: boolean;
  /** Enough of the merchant id to recognise it, never the whole value. */
  merchantHint: string | null;
  /** Where Zibal sends the customer back. Must be registered in their panel. */
  callbackUrl: string;
  canGoLive: boolean;
  /** Why live mode is unavailable, if it is. */
  blockedReason: string | null;
}

export async function getPaymentModeStatus(): Promise<PaymentModeStatus> {
  const merchant = configuredMerchant();
  const live = await isLiveMode();

  return {
    live,
    gateway: env.ZIBAL_MERCHANT_ID ? "ZIBAL" : "ZARINPAL",
    merchantConfigured: merchant !== null,
    merchantHint: merchant ? `${merchant.slice(0, 6)}…${merchant.slice(-2)}` : null,
    callbackUrl:
      env.ZIBAL_CALLBACK_URL ?? `${env.APP_URL}${env.API_PREFIX}/payments/callback/zibal`,
    canGoLive: merchant !== null,
    blockedReason:
      merchant === null
        ? "شناسه پذیرنده (ZIBAL_MERCHANT_ID) روی سرور تنظیم نشده است، بنابراین پرداخت واقعی ممکن نیست."
        : null,
  };
}

/**
 * Switches real payments on or off.
 *
 * Going live is refused without a real merchant id, because the alternative is
 * a shop that says it takes payments and quietly takes none. Every change is
 * written to the audit log and to the server log at warning level: this is the
 * one setting where "who turned this on, and when" is the first question asked
 * after something goes wrong with money.
 */
export async function setLiveMode(live: boolean, actorId: string): Promise<PaymentModeStatus> {
  if (live && configuredMerchant() === null) {
    throw new AppError(
      "برای فعال‌سازی پرداخت واقعی، شناسه پذیرنده زیبال باید روی سرور تنظیم شده باشد.",
      400,
      "PAYMENT_MERCHANT_NOT_CONFIGURED",
    );
  }

  const previous = await isLiveMode();
  const value = live ? "true" : "false";

  const setting = await prisma.setting.upsert({
    where: { key: PAYMENT_LIVE_MODE_KEY },
    update: { value },
    create: {
      key: PAYMENT_LIVE_MODE_KEY,
      value,
      group: "payments",
      // Never public: the storefront has no business reading it, and it would
      // tell an attacker whether cards are real.
      isPublic: false,
      description: "Real payments are live when true; the gateway is in sandbox when false",
    },
  });

  if (previous !== live) {
    logger.warn(
      { actorId, live, previous },
      live
        ? "payment mode switched to LIVE — real money will now move"
        : "payment mode switched to SANDBOX — no money will move",
    );
  }

  await logAudit({
    userId: actorId,
    action: "UPDATE",
    entityType: "Setting",
    entityId: setting.id,
    metadata: {
      setting: PAYMENT_LIVE_MODE_KEY,
      before: previous ? "live" : "sandbox",
      after: live ? "live" : "sandbox",
    },
  });

  return getPaymentModeStatus();
}
