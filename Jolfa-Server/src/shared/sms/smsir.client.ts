import { env } from "../../config/env.js";
import { logger } from "../logger.js";

/**
 * SMS.ir web-service client.
 *
 * Docs: https://sms.ir/rest-api/ — two sending methods matter here.
 *
 *   POST /v1/send/verify  a template registered in SMS.ir's panel, sent from a
 *                         service line. Seconds to arrive, reaches recipients
 *                         who have blocked advertising SMS, needs no line
 *                         number. The only correct path for a one-time code.
 *   POST /v1/send/bulk    free text from the shop's own line. Needs a line
 *                         number, and the docs are explicit that an un-serviced
 *                         line will not deliver to blocked recipients.
 *
 * The single most important thing in this file is that SMS.ir answers HTTP 200
 * for logical failures and puts the real outcome in `status` in the body. The
 * previous implementation checked only `response.ok`, so "insufficient credit"
 * (102) and "number is blacklisted" (115) were both recorded as sent. A code
 * that never arrived looked delivered in our own records.
 */

const BASE = "https://api.sms.ir/v1";

/** `status` values from the docs. 1 is the only success. */
const STATUS_MESSAGES: Record<number, string> = {
  0: "خطای سامانه پیامک؛ با پشتیبانی تماس بگیرید",
  1: "موفق",
  10: "کلید وب‌سرویس نامعتبر است",
  11: "کلید وب‌سرویس غیرفعال است",
  12: "کلید وب‌سرویس به IPهای مشخصی محدود شده است",
  13: "حساب کاربری پیامک غیرفعال است",
  14: "حساب کاربری پیامک در حالت تعلیق است",
  20: "تعداد درخواست بیش از حد مجاز است",
  101: "شماره خط نامعتبر است",
  102: "اعتبار پیامک کافی نیست",
  103: "متن پیامک خالی است",
  104: "شماره موبایل نادرست است",
  105: "تعداد شماره‌ها بیش از حد مجاز (۱۰۰) است",
  106: "تعداد متن‌ها بیش از حد مجاز (۱۰۰) است",
  107: "لیست شماره‌ها خالی است",
  108: "لیست متن‌ها خالی است",
  109: "زمان ارسال نامعتبر است",
  110: "تعداد شماره‌ها و متن‌ها برابر نیست",
  111: "ارسالی با این شناسه ثبت نشده است",
  112: "رکوردی برای حذف یافت نشد",
  113: "قالب پیامک یافت نشد",
  114: "مقدار پارامتر بیش از ۲۵ کاراکتر است",
  115: "شماره موبایل در لیست سیاه سامانه است",
  116: "نام پارامتر نمی‌تواند خالی باشد",
  117: "متن ارسال‌شده تایید نشده است",
  118: "تعداد پیام‌ها بیش از حد مجاز است",
  119: "برای قالب شخصی‌سازی‌شده باید پلن را ارتقا دهید",
  123: "خط ارسال‌کننده نیاز به فعال‌سازی دارد",
};

/** Delivery states from the docs, for the admin's SMS log. */
const DELIVERY_MESSAGES: Record<number, string> = {
  1: "رسیده به گوشی",
  2: "نرسیده به گوشی",
  3: "در حال پردازش در مخابرات",
  4: "نرسیده به مخابرات",
  5: "رسیده به مخابرات",
  6: "خطا",
  7: "لیست سیاه",
};

export function describeSmsIrStatus(status: number | null | undefined): string {
  if (status === null || status === undefined) return "وضعیت نامشخص";
  return STATUS_MESSAGES[status] ?? `وضعیت ناشناخته (${status})`;
}

export function describeDeliveryState(state: number | null | undefined): string {
  if (state === null || state === undefined) return "در انتظار";
  return DELIVERY_MESSAGES[state] ?? `وضعیت ناشناخته (${state})`;
}

/** A parameter value longer than this is rejected outright (status 114). */
export const MAX_PARAMETER_LENGTH = 25;

export class SmsIrError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
    readonly httpStatus: number | null,
  ) {
    super(message);
    this.name = "SmsIrError";
  }
}

/**
 * Normalises a mobile number to the local `09xxxxxxxxx` form.
 *
 * Numbers reach us from several places — a Persian keyboard, a pasted contact,
 * an imported list — so `۰۹۱۲…`, `+98912…`, `0098912…` and `912…` all occur.
 * SMS.ir accepts several of these, but normalising first means our own logs and
 * the blacklist checks compare equal, and an unparseable number fails here with
 * something readable rather than as status 104 after a round trip.
 */
export function normalizeMobile(raw: string): string | null {
  const ascii = raw
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[\s()-]/g, "");

  const digits = ascii
    .replace(/^\+98/, "0")
    .replace(/^0098/, "0")
    .replace(/^98(?=9\d{9}$)/, "0")
    .replace(/^9(?=\d{9}$)/, "09");

  return /^09\d{9}$/.test(digits) ? digits : null;
}

export function isSmsIrConfigured(): boolean {
  return Boolean(env.SMS_IR_API_KEY);
}

/** The shop's own line, needed only for free-text sends. */
export function smsIrLineNumber(): string | null {
  return env.SMS_SENDER_NUMBER?.trim() || null;
}

interface SmsIrEnvelope<T> {
  status?: number;
  message?: string;
  data?: T;
}

async function call<T>(
  path: string,
  init: { method: "GET" | "POST"; body?: unknown },
): Promise<T> {
  if (!env.SMS_IR_API_KEY) {
    throw new SmsIrError("سرویس پیامک پیکربندی نشده است", null, null);
  }

  let response: Response;
  try {
    response = await fetch(`${BASE}${path}`, {
      method: init.method,
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        "x-api-key": env.SMS_IR_API_KEY,
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      // A hung SMS provider must not hold a checkout or a login open.
      signal: AbortSignal.timeout(15_000),
    });
  } catch (error) {
    logger.error({ err: error, path }, "sms.ir request failed at the network level");
    throw new SmsIrError("ارتباط با سرویس پیامک برقرار نشد", null, null);
  }

  const envelope = (await response.json().catch(() => ({}))) as SmsIrEnvelope<T>;
  const status = envelope.status ?? null;

  // Both halves matter: a logical failure can arrive as HTTP 200 with
  // `status: 102`, and an auth failure as HTTP 401 with no body at all.
  if (!response.ok || status !== 1) {
    const reason = status !== null ? describeSmsIrStatus(status) : `HTTP ${response.status}`;
    logger.error(
      { path, httpStatus: response.status, status, message: envelope.message },
      "sms.ir rejected a request",
    );
    throw new SmsIrError(reason, status, response.status);
  }

  return envelope.data as T;
}

export interface VerifyParameter {
  name: string;
  value: string;
}

export interface SmsIrSendResult {
  messageId: number | null;
  cost: number | null;
}

/**
 * Sends a template message (an OTP, an order code) from a service line.
 *
 * Parameter values are truncated to 25 characters rather than left to fail with
 * status 114: a notification that does not arrive is worse than one whose long
 * field is clipped, and the only values we pass are codes and order numbers.
 */
export async function sendVerify(input: {
  mobile: string;
  templateId: number;
  parameters: VerifyParameter[];
}): Promise<SmsIrSendResult> {
  const mobile = normalizeMobile(input.mobile);
  if (!mobile) {
    throw new SmsIrError("شماره موبایل نادرست است", 104, null);
  }

  const data = await call<{ messageId?: number; cost?: number }>("/send/verify", {
    method: "POST",
    body: {
      mobile,
      templateId: input.templateId,
      parameters: input.parameters.map((parameter) => ({
        name: parameter.name,
        value: parameter.value.slice(0, MAX_PARAMETER_LENGTH),
      })),
    },
  });

  return { messageId: data?.messageId ?? null, cost: data?.cost ?? null };
}

/** Sends free text from the shop's own line. Requires a configured line number. */
export async function sendBulk(input: {
  mobiles: string[];
  messageText: string;
}): Promise<{ packId: string | null; messageIds: (number | null)[]; cost: number | null }> {
  const lineNumber = smsIrLineNumber();
  if (!lineNumber) {
    throw new SmsIrError(
      "شماره خط ارسال پیامک تنظیم نشده است (SMS_SENDER_NUMBER)",
      101,
      null,
    );
  }

  const mobiles = input.mobiles.map(normalizeMobile).filter((m): m is string => m !== null);
  if (mobiles.length === 0) {
    throw new SmsIrError("شماره موبایل نادرست است", 104, null);
  }

  const data = await call<{ packId?: string; messageIds?: (number | null)[]; cost?: number }>(
    "/send/bulk",
    { method: "POST", body: { lineNumber: Number(lineNumber), messageText: input.messageText, mobiles } },
  );

  // A zero means the number is blacklisted and a null means it was rejected as
  // invalid or over-length. Neither is an error for the pack as a whole, so the
  // caller has to look at them to know whether this recipient was reached.
  return {
    packId: data?.packId ?? null,
    messageIds: data?.messageIds ?? [],
    cost: data?.cost ?? null,
  };
}

/** Remaining credit. Used by the admin panel; sends nothing. */
export async function getCredit(): Promise<number> {
  return call<number>("/credit", { method: "GET" });
}

/** Lines available for free-text sending. Sends nothing. */
export async function getLines(): Promise<number[]> {
  return call<number[]>("/line", { method: "GET" });
}

/** Delivery state of one sent message, for the admin's SMS log. */
export async function getMessageReport(messageId: number): Promise<{
  deliveryState: number | null;
  cost: number | null;
  sendDateTime: number | null;
}> {
  const data = await call<{ deliveryState?: number; cost?: number; sendDateTime?: number }>(
    `/send/${messageId}`,
    { method: "GET" },
  );
  return {
    deliveryState: data?.deliveryState ?? null,
    cost: data?.cost ?? null,
    sendDateTime: data?.sendDateTime ?? null,
  };
}
