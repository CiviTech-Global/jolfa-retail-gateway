import { env } from "../../config/env.js";
import { AppError } from "../../shared/app-error.js";
import { logger } from "../../shared/logger.js";

/**
 * TorobPay credit purchase gateway (CPG) client.
 *
 * Spec: "مستندات درگاه خرید اعتباری (CPG) ترب‌پی", v1.3.31 (25 Oct 2026).
 *
 * The customer pays the first instalment on TorobPay's page and the rest to
 * TorobPay directly; the shop is paid in full. An order moves through these
 * states on TorobPay's side:
 *
 *   NEW -> IPG -> W_FOR_VERIFY --verify--> W_FOR_SETTLE --settle--> ONGOING
 *                      |                         |
 *                      +--revert (<30 min)--> CANCELED / FAILED
 *                                     ONGOING --cancel--> CANCELED (Paya refund)
 *
 * Deadlines that matter to us, all enforced by TorobPay:
 *   - not verified within 10 min of payment -> FAILED and refunded;
 *   - not settled within 10 min of verify   -> settled automatically;
 *   - revert only within 30 min of payment; after that it must be cancel.
 *
 * Every endpoint except the token one authenticates with a 1-hour JWT, which
 * is cached here per process. All amounts are in RIAL.
 */

/** TorobPay's limits on an order, in Rial: 20,000 to 100,000,000 Toman. */
export const TOROBPAY_MIN_RIAL = 200_000;
export const TOROBPAY_MAX_RIAL = 1_000_000_000;

/** Revert (instant refund through the card gateway) is only allowed this long after payment. */
export const TOROBPAY_REVERT_WINDOW_MS = 30 * 60 * 1000;

/** The token lives an hour; refresh with a margin so a request never carries one that expires in flight. */
const TOKEN_TTL_MS = 55 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 20_000;

/** TorobPay's logical error codes we act on. */
export const TOROBPAY_ERROR = {
  INVALID_TOKEN: 1005,
  NO_ORDER: 1007,
  TOKEN_ORDER_MISMATCH: 1048,
  INVALID_ORDER_STATE: 1053,
  TOO_LATE_FOR_REVERT: 1065,
  INACTIVE_MERCHANT: 1099,
  /** Token endpoint: no merchant with this client id and secret. */
  NO_MERCHANT: 1017,
  /** Token endpoint: wrong username or password (not in the PDF; seen live). */
  INVALID_CREDENTIALS: 1024,
} as const;

/**
 * A failure reported by TorobPay, or our failure to reach it.
 *
 * `torobCode` is TorobPay's own logical code (1053 and so on), which callers
 * branch on; it is null when TorobPay never answered. The message shown to the
 * customer is TorobPay's `user_message` when it sent one.
 */
export class TorobPayError extends AppError {
  readonly torobCode: number | null;

  constructor(message: string, statusCode: number, torobCode: number | null) {
    super(message, statusCode, "TOROBPAY_ERROR");
    this.torobCode = torobCode;
  }
}

interface Credentials {
  clientId: string;
  clientSecret: string;
  username: string;
  password: string;
}

function readCredentials(): Credentials | null {
  const clientId = env.TOROBPAY_CLIENT_ID?.trim();
  const clientSecret = env.TOROBPAY_CLIENT_SECRET?.trim();
  const username = env.TOROBPAY_USERNAME?.trim();
  const password = env.TOROBPAY_PASSWORD?.trim();
  if (!clientId || !clientSecret || !username || !password) return null;
  return { clientId, clientSecret, username, password };
}

/** True when all four merchant credentials are set. */
export function isTorobPayConfigured(): boolean {
  return readCredentials() !== null;
}

/** Enough of the client id to recognise it in the admin panel, never the whole value. */
export function torobPayClientHint(): string | null {
  const id = readCredentials()?.clientId;
  if (!id) return null;
  return id.length <= 8 ? `${id.slice(0, 2)}…` : `${id.slice(0, 4)}…${id.slice(-2)}`;
}

interface ErrorBody {
  code?: number | string;
  errorCode?: number | string;
  message?: string;
  user_message?: string;
  userMessage?: string;
  data?: unknown;
}

interface Envelope<T> {
  successful?: boolean;
  response?: T;
  /** The shape the PDF documents. */
  error?: ErrorBody;
  /**
   * The shape the live service actually sends (seen 21 Nov 2026):
   * `{"successful":false,"errorData":{"errorCode":"1024","message":"..."}}`,
   * with the code as a string. Both are read, so the fallbacks that branch on
   * a code (1053, 1065) work whichever one TorobPay uses.
   */
  errorData?: ErrorBody;
}

interface ParsedError {
  code: number | null;
  message: string | null;
  userMessage: string | null;
}

function parseError(envelope: Envelope<unknown>): ParsedError {
  const body = envelope.errorData ?? envelope.error ?? {};
  const rawCode = body.errorCode ?? body.code;
  const code = rawCode === undefined || rawCode === null ? NaN : Number(rawCode);
  return {
    code: Number.isFinite(code) ? code : null,
    message: body.message ?? null,
    userMessage: (body.user_message ?? body.userMessage)?.trim() || null,
  };
}

let cachedToken: { value: string; expiresAt: number } | null = null;

/** For tests: forget the cached access token. */
export function resetTorobPayTokenCache(): void {
  cachedToken = null;
}

function baseUrl(): string {
  return env.TOROBPAY_BASE_URL.replace(/\/+$/, "");
}

async function send(url: string, init: RequestInit, path: string): Promise<Response> {
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  } catch (error) {
    // Without a deadline a hung gateway holds the customer on a white page,
    // not knowing whether they have been charged.
    logger.error({ err: error, path }, "torobpay request failed at the network level");
    throw new TorobPayError(
      "ارتباط با ترب‌پی برقرار نشد. لطفاً دوباره تلاش کنید.",
      502,
      null,
    );
  }
}

async function readEnvelope<T>(response: Response, path: string): Promise<Envelope<T>> {
  try {
    return (await response.json()) as Envelope<T>;
  } catch {
    logger.error({ path, status: response.status }, "torobpay returned a body that is not JSON");
    throw new TorobPayError("ترب‌پی پاسخ معتبری برنگرداند. لطفاً دوباره تلاش کنید.", 502, null);
  }
}

function toError(envelope: Envelope<unknown>, httpStatus: number, path: string): TorobPayError {
  const { code, message, userMessage } = parseError(envelope);
  // Logged without the request body: it holds the customer's address and phone.
  logger.warn({ path, httpStatus, torobCode: code, message }, "torobpay rejected a request");
  return new TorobPayError(
    userMessage || "درخواست توسط ترب‌پی پذیرفته نشد. لطفاً دوباره تلاش کنید.",
    // Our own answer to the browser: a refusal by the upstream gateway is a
    // bad gateway from our client's point of view, whatever status it used.
    502,
    code,
  );
}

async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now()) return cachedToken.value;

  const credentials = readCredentials();
  if (!credentials) {
    throw new TorobPayError("درگاه ترب‌پی پیکربندی نشده است.", 503, null);
  }

  const path = "/api/online/v1/oauth/token";
  const basic = Buffer.from(`${credentials.clientId}:${credentials.clientSecret}`).toString("base64");
  const response = await send(
    `${baseUrl()}${path}`,
    {
      method: "POST",
      headers: { authorization: `Basic ${basic}`, "content-type": "application/json" },
      body: JSON.stringify({ username: credentials.username, password: credentials.password }),
    },
    path,
  );

  const envelope = await readEnvelope<{ access_token?: string }>(response, path);
  // The spec shows the token both bare and inside the usual envelope.
  const token =
    envelope.response?.access_token ?? (envelope as { access_token?: string }).access_token;

  if (!response.ok || !token) {
    const { code, message } = parseError(envelope);
    logger.error(
      { httpStatus: response.status, torobCode: code, message },
      "torobpay refused the merchant credentials",
    );
    // Which half is wrong tells the owner what to re-copy from TorobPay's panel.
    const reason =
      code === TOROBPAY_ERROR.INVALID_CREDENTIALS
        ? "نام کاربری یا رمز عبور ترب‌پی نادرست است."
        : code === TOROBPAY_ERROR.NO_MERCHANT
          ? "کد پذیرنده یا کلید ترب‌پی نادرست است."
          : code === TOROBPAY_ERROR.INACTIVE_MERCHANT
            ? "حساب پذیرنده در ترب‌پی غیرفعال است."
            : "ورود به ترب‌پی ناموفق بود. اطلاعات پذیرنده را بررسی کنید.";
    throw new TorobPayError(reason, 502, code);
  }

  cachedToken = { value: token, expiresAt: Date.now() + TOKEN_TTL_MS };
  return token;
}

async function call<T>(
  method: "GET" | "POST",
  path: string,
  options: { query?: Record<string, string>; body?: unknown } = {},
  retried = false,
): Promise<T> {
  const token = await getAccessToken();
  const query = options.query ? `?${new URLSearchParams(options.query).toString()}` : "";

  const response = await send(
    `${baseUrl()}${path}${query}`,
    {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        ...(options.body === undefined ? {} : { "content-type": "application/json" }),
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    },
    path,
  );

  // A token TorobPay no longer accepts (revoked, clock skew, a restart on
  // their side) is renewed once rather than failing the customer's payment.
  if (response.status === 401 && !retried) {
    cachedToken = null;
    return call<T>(method, path, options, true);
  }

  const envelope = await readEnvelope<T>(response, path);
  if (!response.ok || envelope.successful === false || envelope.response === undefined) {
    throw toError(envelope, response.status, path);
  }
  return envelope.response;
}

// ---- endpoints ------------------------------------------------------------

export interface TorobPayEligibility {
  eligible: boolean;
  title: string | null;
  description: string | null;
}

/** Whether the TorobPay option may be offered for this amount. Called on every checkout. */
export async function checkTorobPayEligibility(amountRial: number): Promise<TorobPayEligibility> {
  const data = await call<{
    eligible?: boolean;
    title_message?: string;
    message_title?: string;
    description?: string;
  }>("GET", "/api/online/offer/v1/eligible", { query: { amount: String(amountRial) } });

  return {
    eligible: data.eligible === true,
    // The spec spells this field two ways in one page.
    title: data.title_message ?? data.message_title ?? null,
    description: data.description ?? null,
  };
}

export interface TorobPayCartItem {
  id: string;
  name: string;
  count: number;
  /** Unit price, in Rial. */
  amount: number;
  category: string;
}

export interface TorobPaySessionInput {
  amountRial: number;
  returnUrl: string;
  transactionId: string;
  mobile?: string;
  cart: {
    cartId: string;
    totalAmountRial: number;
    taxAmountRial: number;
    shippingAmountRial: number;
    items: TorobPayCartItem[];
  };
  customer: {
    fullName: string;
    address: string;
    postalCode: string;
    city: string;
    province: string;
    registrationPhone: string;
  };
}

export interface TorobPaySession {
  paymentToken: string;
  paymentPageUrl: string;
}

/**
 * Opens a payment at TorobPay. The order is created there in state NEW and
 * fails on its own if the customer has not reached the page within 15 min.
 */
export async function createTorobPaySession(input: TorobPaySessionInput): Promise<TorobPaySession> {
  const body = {
    amount: input.amountRial,
    paymentMethodTypeDto: "ONLINE_CREDIT",
    returnURL: input.returnUrl,
    transactionId: input.transactionId,
    ...(input.mobile && /^09\d{9}$/.test(input.mobile) ? { mobile: input.mobile } : {}),
    cartList: [
      {
        cartId: input.cart.cartId,
        totalAmount: input.cart.totalAmountRial,
        taxAmount: input.cart.taxAmountRial,
        shippingAmount: input.cart.shippingAmountRial,
        // Our total already contains both: they are itemised, not added on.
        isTaxIncluded: true,
        isShipmentIncluded: true,
        cartItems: input.cart.items.map((item) => ({
          id: item.id,
          name: item.name,
          count: item.count,
          amount: item.amount,
          category: item.category,
          commissionType: 0,
        })),
      },
    ],
    address: input.customer.address,
    postalCode: input.customer.postalCode,
    customer_full_name: input.customer.fullName,
    city: input.customer.city,
    province: input.customer.province,
    registration_phone_number: input.customer.registrationPhone,
  };

  const data = await call<{ paymentToken?: string; paymentPageUrl?: string }>(
    "POST",
    "/api/online/payment/v1/token",
    { body },
  );

  if (!data.paymentToken || !data.paymentPageUrl) {
    logger.error({ transactionId: input.transactionId }, "torobpay opened a session without a token or page url");
    throw new TorobPayError("ایجاد پرداخت در ترب‌پی ناموفق بود. لطفاً دوباره تلاش کنید.", 502, null);
  }

  logger.info({ transactionId: input.transactionId }, "torobpay payment session created");
  return { paymentToken: data.paymentToken, paymentPageUrl: data.paymentPageUrl };
}

async function tokenAction(path: string, paymentToken: string): Promise<{ transactionId: string | null }> {
  const data = await call<{ transactionId?: string }>("POST", path, { body: { paymentToken } });
  return { transactionId: data.transactionId ?? null };
}

/** W_FOR_VERIFY -> W_FOR_SETTLE. Must happen within 10 min of payment. */
export function verifyTorobPay(paymentToken: string) {
  return tokenAction("/api/online/payment/v1/verify", paymentToken);
}

/** W_FOR_SETTLE -> ONGOING. TorobPay settles on its own after 10 min if we do not. */
export function settleTorobPay(paymentToken: string) {
  return tokenAction("/api/online/payment/v1/settle", paymentToken);
}

/** Cancels within 30 min of payment; the card payment is reversed at once. */
export function revertTorobPay(paymentToken: string) {
  return tokenAction("/api/online/payment/v1/revert", paymentToken);
}

/** Cancels later; paid instalments are refunded by Paya transfer. */
export function cancelTorobPay(paymentToken: string) {
  return tokenAction("/api/online/payment/v1/cancel", paymentToken);
}

/**
 * TorobPay's summary of an order's state:
 *   PENDING = NEW, IPG, W_FOR_VERIFY (not yet confirmed by us)
 *   VERIFY  = W_FOR_SETTLE           (verified, awaiting settle)
 *   SETTLE  = ONGOING, PAID, UPDATED (done)
 *   REVERT  = FAILED, CANCELED
 */
export type TorobPayStatus = "PENDING" | "VERIFY" | "SETTLE" | "REVERT";

export interface TorobPayStatusResult {
  status: TorobPayStatus | null;
  /** The raw value, kept for the record when it is not one we know. */
  rawStatus: string | null;
  amountRial: number | null;
  transactionId: string | null;
}

const KNOWN_STATUSES: readonly TorobPayStatus[] = ["PENDING", "VERIFY", "SETTLE", "REVERT"];

export async function getTorobPayStatus(paymentToken: string): Promise<TorobPayStatusResult> {
  const data = await call<{ status?: string; amount?: number; transactionId?: string }>(
    "GET",
    "/api/online/payment/v1/status",
    { query: { paymentToken } },
  );
  const raw = data.status ?? null;
  return {
    status: raw && (KNOWN_STATUSES as readonly string[]).includes(raw) ? (raw as TorobPayStatus) : null,
    rawStatus: raw,
    amountRial: typeof data.amount === "number" ? data.amount : null,
    transactionId: data.transactionId ?? null,
  };
}

/** Persian label for a status, for the admin panel. */
export function describeTorobPayStatus(status: TorobPayStatus | null, raw: string | null): string {
  switch (status) {
    case "PENDING":
      return "در انتظار پرداخت یا تأیید";
    case "VERIFY":
      return "تأییدشده، در انتظار تسویه";
    case "SETTLE":
      return "پرداخت‌شده و نهایی";
    case "REVERT":
      return "ناموفق یا لغوشده";
    default:
      return raw ? `وضعیت ناشناخته (${raw})` : "نامشخص";
  }
}
