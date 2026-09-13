import { env } from "../../config/env.js";
import { AppError } from "../../shared/app-error.js";
import { logger } from "../../shared/logger.js";

/**
 * Zibal Internet Payment Gateway (IPG) client.
 *
 * Spec: https://help.zibal.ir/ipg/ — the page renders an OpenAPI document
 * served from https://api.zibal.ir/static/helpdocs/ipg.json, which is where the
 * field names and the code tables below come from.
 *
 * The flow has three legs and all three matter:
 *
 *   1. POST /v1/request          -> trackId
 *   2. browser GET /start/{trackId}  (customer pays on Zibal's page)
 *   3. Zibal GETs our callbackUrl, then we POST /v1/verify to settle
 *
 * Leg 3 is not optional bookkeeping. Until the merchant calls verify, Zibal
 * treats the payment as unsettled: status 2 is "paid, unverified". The callback
 * alone is a claim from the customer's browser and must never be trusted on its
 * own — verify is the only statement from Zibal we can rely on.
 */

const ZIBAL_BASE = "https://gateway.zibal.ir";

/**
 * Zibal's documented test merchant. Sending the literal string `zibal` puts the
 * gateway in sandbox: a real payment page is shown but no money moves.
 *
 * There is no separate sandbox hostname — the host is the same in both modes,
 * and only this value decides whether a payment is real. That makes it the one
 * setting worth being loud about, hence the startup log in `resolveMerchant`.
 */
export const ZIBAL_SANDBOX_MERCHANT = "zibal";

/** Result codes from POST /v1/request. 100 is the only success. */
const REQUEST_RESULT_MESSAGES: Record<number, string> = {
  100: "با موفقیت تایید شد",
  102: "شناسه پذیرنده یافت نشد",
  103: "پذیرنده غیرفعال است یا قرارداد درگاه امضا نشده",
  104: "شناسه پذیرنده نامعتبر است",
  105: "مبلغ باید بیشتر از ۱۰۰۰ ریال باشد",
  106: "آدرس بازگشت نامعتبر است (باید با http یا https شروع شود)",
  107: "percentMode نامعتبر است",
  108: "یک یا چند ذی‌نفع در تسهیم نامعتبر است",
  109: "یک یا چند ذی‌نفع در تسهیم غیرفعال است",
  110: "id = self در اطلاعات تسهیم وجود ندارد",
  111: "مبلغ با مجموع سهم‌های تسهیم برابر نیست",
  112: "موجودی کیف پول کارمزد کافی نیست",
  113: "مبلغ تراکنش از سقف مجاز بیشتر است",
  114: "کد ملی ارسالی نامعتبر است",
  115: "IP سرور در پنل زیبال ثبت نشده است",
  116: "feeMode نامعتبر است",
};

/**
 * Result codes from POST /v1/verify.
 *
 * 201 ("already verified") is a success for our purposes: it means a previous
 * verify call landed. A retried callback, a customer refreshing the return
 * page, or our own retry after a timeout all produce it, and treating it as a
 * failure would mark a genuinely paid order as failed.
 */
const VERIFY_RESULT_MESSAGES: Record<number, string> = {
  100: "با موفقیت تایید شد",
  102: "شناسه پذیرنده یافت نشد",
  103: "پذیرنده غیرفعال است",
  104: "شناسه پذیرنده نامعتبر است",
  201: "این پرداخت قبلاً تایید شده است",
  202: "سفارش پرداخت نشده یا پرداخت ناموفق بوده است",
  203: "شناسه پیگیری نامعتبر است",
};

/** Payment-session states. Only 1 and 2 mean the customer's money moved. */
const STATUS_MESSAGES: Record<number, string> = {
  [-1]: "در انتظار پرداخت",
  [-2]: "خطای داخلی درگاه",
  1: "پرداخت شده - تاییدشده",
  2: "پرداخت شده - تاییدنشده",
  3: "لغو شده توسط کاربر",
  4: "شماره کارت نامعتبر است",
  5: "موجودی حساب کافی نیست",
  6: "رمز واردشده اشتباه است",
  7: "تعداد درخواست‌ها بیش از حد مجاز است",
  8: "تعداد پرداخت اینترنتی روزانه بیش از حد مجاز است",
  9: "مبلغ پرداخت اینترنتی روزانه بیش از حد مجاز است",
  10: "صادرکننده کارت نامعتبر است",
  11: "خطای سوییچ",
  12: "کارت قابل دسترسی نیست",
  15: "تراکنش استرداد شده",
  16: "تراکنش در حال استرداد",
  18: "تراکنش ریورس شده",
  21: "پذیرنده نامعتبر است",
};

export function describeZibalStatus(status: number | null | undefined): string {
  if (status === null || status === undefined) return "نامشخص";
  return STATUS_MESSAGES[status] ?? `وضعیت ناشناخته (${status})`;
}

/** Paid states. 2 is paid-but-unverified, which verify then settles into 1. */
export function isPaidStatus(status: number | null | undefined): boolean {
  return status === 1 || status === 2;
}

export interface ZibalRequestInput {
  /** In RIAL. Callers hold Toman, so the conversion belongs to them, explicitly. */
  amountRial: number;
  callbackUrl: string;
  orderId?: string;
  description?: string;
  mobile?: string;
}

export interface ZibalRequestResult {
  trackId: string;
  sandbox: boolean;
}

export interface ZibalVerifyResult {
  result: number;
  status: number | null;
  /** In RIAL, as Zibal reports it. */
  amountRial: number | null;
  refNumber: string | null;
  cardNumber: string | null;
  paidAt: string | null;
  orderId: string | null;
  message: string;
  /** True for result 100 and for 201 (already verified). */
  verified: boolean;
}

export function isSandbox(): boolean {
  // Defaults to sandbox. An unset flag on a machine that happens to hold a live
  // merchant id must not start charging cards; going live is a deliberate act.
  return env.ZIBAL_SANDBOX !== "false";
}

function resolveMerchant(): string {
  if (isSandbox()) return ZIBAL_SANDBOX_MERCHANT;

  const merchant = env.ZIBAL_MERCHANT_ID;
  if (!merchant) {
    throw new AppError(
      "درگاه پرداخت پیکربندی نشده است (ZIBAL_MERCHANT_ID تنظیم نشده)",
      500,
      "PAYMENT_GATEWAY_NOT_CONFIGURED",
    );
  }
  return merchant;
}

async function callZibal<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const url = `${ZIBAL_BASE}${path}`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      // Without a deadline a hung gateway holds the request open until the
      // proxy gives up, and the customer sits on a white page not knowing
      // whether they have been charged.
      signal: AbortSignal.timeout(20_000),
    });
  } catch (error) {
    logger.error({ err: error, path }, "zibal request failed at the network level");
    throw new AppError(
      "ارتباط با درگاه پرداخت برقرار نشد. لطفاً دوباره تلاش کنید.",
      502,
      "PAYMENT_GATEWAY_UNREACHABLE",
    );
  }

  if (!response.ok) {
    logger.error({ path, status: response.status }, "zibal returned a non-2xx response");
    throw new AppError(
      "درگاه پرداخت پاسخ معتبری برنگرداند. لطفاً دوباره تلاش کنید.",
      502,
      "PAYMENT_GATEWAY_ERROR",
    );
  }

  return (await response.json()) as T;
}

export async function createZibalPayment(input: ZibalRequestInput): Promise<ZibalRequestResult> {
  const merchant = resolveMerchant();
  const sandbox = isSandbox();

  const payload: Record<string, unknown> = {
    merchant,
    amount: input.amountRial,
    callbackUrl: input.callbackUrl,
  };
  if (input.orderId) payload.orderId = input.orderId;
  if (input.description) payload.description = input.description;
  // Pre-fills the customer's saved cards on Zibal's page. Only sent when it
  // looks like an Iranian mobile number, since a malformed one is rejected.
  if (input.mobile && /^09\d{9}$/.test(input.mobile)) payload.mobile = input.mobile;

  const data = await callZibal<{ result: number; trackId?: number | string; message?: string }>(
    "/v1/request",
    payload,
  );

  if (data.result !== 100 || !data.trackId) {
    const reason = REQUEST_RESULT_MESSAGES[data.result] ?? data.message ?? "خطای نامشخص";
    logger.error({ result: data.result, message: data.message, sandbox }, "zibal rejected a payment request");
    throw new AppError(`ایجاد تراکنش در درگاه پرداخت ناموفق بود: ${reason}`, 502, "PAYMENT_REQUEST_REJECTED");
  }

  logger.info({ trackId: String(data.trackId), sandbox }, "zibal payment session created");

  return { trackId: String(data.trackId), sandbox };
}

export async function verifyZibalPayment(trackId: string): Promise<ZibalVerifyResult> {
  const merchant = resolveMerchant();

  const data = await callZibal<{
    result: number;
    status?: number;
    amount?: number;
    refNumber?: number | string;
    cardNumber?: string;
    paidAt?: string;
    orderId?: string;
    message?: string;
  }>("/v1/verify", {
    merchant,
    // Zibal types trackId as an integer. It exceeds 2^32 but stays inside
    // Number.MAX_SAFE_INTEGER, so this round-trips exactly; it is kept as a
    // string everywhere else because it is an identifier, not a quantity.
    trackId: Number(trackId),
  });

  const verified = data.result === 100 || data.result === 201;

  return {
    result: data.result,
    status: data.status ?? null,
    amountRial: data.amount ?? null,
    refNumber: data.refNumber === undefined ? null : String(data.refNumber),
    cardNumber: data.cardNumber ?? null,
    paidAt: data.paidAt ?? null,
    orderId: data.orderId ?? null,
    message: VERIFY_RESULT_MESSAGES[data.result] ?? data.message ?? "خطای نامشخص",
    verified,
  };
}

/** Where the customer is sent to pay. */
export function buildZibalStartUrl(trackId: string): string {
  return `${ZIBAL_BASE}/start/${trackId}`;
}
