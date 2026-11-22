import { randomBytes } from "node:crypto";
import type { Payment, Prisma } from "@prisma/client";
import { prisma } from "../../shared/prisma.js";
import { logger } from "../../shared/logger.js";
import { BadRequestError, NotFoundError } from "../../shared/app-error.js";
import { notifyOrderPaid } from "../../shared/sms/order-notifications.js";
import { queueNotification } from "../../shared/sms/notification-queue.js";
import { tomanToRial } from "./currency.js";
import { createTransaction } from "./transaction.service.js";
import { isTorobPayEnabled, torobPayReturnUrl } from "./torobpay-settings.service.js";
import {
  TOROBPAY_ERROR,
  TOROBPAY_MAX_RIAL,
  TOROBPAY_MIN_RIAL,
  TOROBPAY_REVERT_WINDOW_MS,
  TorobPayError,
  cancelTorobPay,
  checkTorobPayEligibility,
  createTorobPaySession,
  describeTorobPayStatus,
  getTorobPayStatus,
  revertTorobPay,
  settleTorobPay,
  verifyTorobPay,
  type TorobPayStatus,
} from "./torobpay.client.js";

/**
 * TorobPay on our side: offering it, opening a payment, settling the result,
 * and undoing it when the shop cancels.
 *
 * The rule throughout is the one the Zibal integration follows: the browser's
 * return is a claim, never a fact. An order is marked paid only after TorobPay
 * itself, asked by this server, says the order is verified for the amount we
 * asked for.
 */

// ---- offering it at checkout ---------------------------------------------

export interface PaymentMethodOption {
  id: "ZIBAL" | "TOROBPAY";
  title: string;
  description: string;
}

export const ZIBAL_METHOD: PaymentMethodOption = {
  id: "ZIBAL",
  title: "پرداخت اینترنتی",
  description: "پرداخت آنلاین با تمامی کارت‌های عضو شتاب",
};

function withinTorobPayLimits(amountToman: number): boolean {
  const rial = tomanToRial(amountToman);
  return rial >= TOROBPAY_MIN_RIAL && rial <= TOROBPAY_MAX_RIAL;
}

/**
 * The methods to show for a cart of this total (Toman).
 *
 * TorobPay asks to be consulted on every checkout view, and only shown when it
 * says yes. Anything going wrong with that question — TorobPay down, slow,
 * refusing our credentials — hides the option rather than the checkout: the
 * customer can still pay with a card.
 */
export async function listPaymentMethods(amountToman: number): Promise<PaymentMethodOption[]> {
  const methods: PaymentMethodOption[] = [ZIBAL_METHOD];

  if (!withinTorobPayLimits(amountToman) || !(await isTorobPayEnabled())) {
    return methods;
  }

  try {
    const eligibility = await checkTorobPayEligibility(tomanToRial(amountToman));
    if (eligibility.eligible) {
      methods.push({
        id: "TOROBPAY",
        // TorobPay's own wording, as its guide asks.
        title: eligibility.title ?? "پرداخت اقساطی با ترب‌پی",
        description: eligibility.description ?? "خرید اعتباری و پرداخت در چند قسط",
      });
    }
  } catch (error) {
    logger.warn({ err: error, amountToman }, "torobpay eligibility check failed; option hidden");
  }

  return methods;
}

/** Whether TorobPay may be used for an order of this final amount, checked again at payment time. */
export async function isTorobPaySelectable(amountToman: number): Promise<boolean> {
  return withinTorobPayLimits(amountToman) && (await isTorobPayEnabled());
}

// ---- opening a payment ----------------------------------------------------

/** A session not yet used this long after it was opened is reused rather than replaced. */
const SESSION_REUSE_MS = 10 * 60 * 1000;

function newTransactionId(orderNumber: string): string {
  // Fresh per attempt: TorobPay keys its order on it, and a customer who
  // abandons one attempt and tries again must not collide with the first.
  return `${orderNumber}-${randomBytes(4).toString("hex")}`;
}

function storedPageUrl(payment: Pick<Payment, "gatewayResponse">): string | null {
  const response = payment.gatewayResponse as { paymentPageUrl?: unknown } | null;
  return typeof response?.paymentPageUrl === "string" ? response.paymentPageUrl : null;
}

type OrderForPayment = Prisma.OrderGetPayload<{ include: { payment: true } }>;

export async function startTorobPayPayment(
  order: OrderForPayment,
  userId: string,
): Promise<{ paymentUrl: string; authority: string }> {
  if (!withinTorobPayLimits(order.finalAmount)) {
    throw new BadRequestError(
      "مبلغ سفارش برای خرید اقساطی ترب‌پی باید بین ۲۰٬۰۰۰ و ۱۰۰٬۰۰۰٬۰۰۰ تومان باشد.",
    );
  }
  if (!(await isTorobPayEnabled())) {
    throw new BadRequestError("پرداخت اقساطی با ترب‌پی در حال حاضر فعال نیست.");
  }

  // The same customer pressing "pay" twice, or coming back from the TorobPay
  // page, gets the session already open instead of a second order at TorobPay.
  const existing = order.payment;
  if (
    existing &&
    existing.gateway === "TOROBPAY" &&
    existing.status === "PENDING" &&
    existing.authority &&
    Date.now() - existing.updatedAt.getTime() < SESSION_REUSE_MS
  ) {
    const url = storedPageUrl(existing);
    if (url) return { paymentUrl: url, authority: existing.authority };
  }

  const amountRial = tomanToRial(order.finalAmount);

  // Asked again here, not only at checkout: the page may have sat open while
  // the customer's credit or the shop's eligibility changed.
  const eligibility = await checkTorobPayEligibility(amountRial);
  if (!eligibility.eligible) {
    throw new BadRequestError(
      "خرید اقساطی ترب‌پی برای این سفارش در دسترس نیست. لطفاً روش پرداخت دیگری انتخاب کنید.",
    );
  }

  const details = await prisma.order.findUniqueOrThrow({
    where: { id: order.id },
    include: {
      shippingAddress: true,
      user: { select: { phone: true } },
      items: {
        include: { product: { select: { category: { select: { name: true } } } } },
      },
    },
  });

  const address = details.shippingAddress;
  const transactionId = newTransactionId(order.orderNumber);

  const session = await createTorobPaySession({
    amountRial,
    returnUrl: torobPayReturnUrl(),
    transactionId,
    mobile: details.user?.phone ?? address.phone,
    cart: {
      cartId: order.orderNumber,
      totalAmountRial: amountRial,
      taxAmountRial: tomanToRial(order.taxAmount),
      // TorobPay's cart has no line for packaging or پس‌کرایه; they are
      // delivery-side charges, so they travel with shipping and the itemised
      // cart still adds up to the amount charged.
      shippingAmountRial: tomanToRial(
        order.shippingCost + order.packagingFee + order.collectFreightFee,
      ),
      items: details.items.map((item) => ({
        id: item.productId,
        name: item.productTitle,
        count: item.quantity,
        amount: tomanToRial(item.unitPrice),
        category: item.product.category.name,
      })),
    },
    customer: {
      fullName: address.recipientName,
      address: address.district ? `${address.district}، ${address.addressLine}` : address.addressLine,
      postalCode: address.postalCode ?? "",
      city: address.city,
      province: address.province,
      registrationPhone: details.user?.phone ?? address.phone,
    },
  });

  // Written only after TorobPay answered: a token we never received would be
  // a payment row pointing at a session that does not exist.
  const paymentFields = {
    gateway: "TOROBPAY" as const,
    amount: order.finalAmount,
    authority: session.paymentToken,
    gatewayTransactionId: transactionId,
    refId: null,
    paidAt: null,
    status: "PENDING" as const,
    gatewayResponse: { paymentPageUrl: session.paymentPageUrl },
  };
  const payment = await prisma.payment.upsert({
    where: { orderId: order.id },
    update: paymentFields,
    create: { orderId: order.id, ...paymentFields },
  });

  await createTransaction({
    orderId: order.id,
    paymentId: payment.id,
    type: "PAYMENT",
    amount: order.finalAmount,
    status: "PENDING",
    gateway: "TOROBPAY",
    authority: session.paymentToken,
    metadata: { transactionId, userId },
  });

  return { paymentUrl: session.paymentPageUrl, authority: session.paymentToken };
}

// ---- settling the result --------------------------------------------------

export interface TorobPayOutcome {
  success: boolean;
  /** Neither paid nor failed yet: TorobPay could not be asked, or has not decided. */
  pending?: boolean;
  orderId: string;
  authority: string | null;
  refId?: string | null;
  reason?: string;
}

const PENDING_REASON =
  "نتیجه پرداخت هنوز از ترب‌پی دریافت نشده است. چند دقیقه دیگر وضعیت سفارش را در «سفارش‌های من» ببینید.";

async function markFailed(payment: Payment, reason: string, details: Record<string, unknown>) {
  const { count } = await prisma.payment.updateMany({
    where: { id: payment.id, status: "PENDING" },
    data: { status: "FAILED", gatewayResponse: { ...(payment.gatewayResponse as object), ...details, reason } },
  });
  if (count === 1) {
    await createTransaction({
      orderId: payment.orderId,
      paymentId: payment.id,
      type: "PAYMENT",
      amount: payment.amount,
      status: "FAILED",
      gateway: "TOROBPAY",
      authority: payment.authority ?? undefined,
      metadata: { reason, ...details },
    });
  }
}

/**
 * Writes "paid", once.
 *
 * The customer's return, the result page's fallback check and the background
 * sweep can all reach here for the same payment at the same moment. The
 * conditional update lets exactly one of them through; the others see a count
 * of zero and leave the order, the ledger and the SMS alone.
 */
async function markCompleted(payment: Payment, torobStatus: TorobPayStatus): Promise<boolean> {
  const refId = payment.gatewayTransactionId ?? payment.authority;
  const completed = await prisma.$transaction(async (tx) => {
    const { count } = await tx.payment.updateMany({
      where: { id: payment.id, status: { not: "COMPLETED" } },
      data: {
        status: "COMPLETED",
        refId,
        paidAt: new Date(),
        gatewayResponse: {
          ...(payment.gatewayResponse as object),
          torobStatus,
          transactionId: payment.gatewayTransactionId,
        },
      },
    });
    if (count === 0) return false;

    await tx.order.update({
      where: { id: payment.orderId },
      data: { paymentStatus: "COMPLETED", status: "PROCESSING" },
    });
    await tx.transaction.create({
      data: {
        orderId: payment.orderId,
        paymentId: payment.id,
        type: "PAYMENT",
        amount: payment.amount,
        status: "COMPLETED",
        gateway: "TOROBPAY",
        authority: payment.authority ?? undefined,
        refId,
        metadata: { reason: "Verified with TorobPay", torobStatus },
      },
    });
    return true;
  });

  if (completed) {
    // Not awaited: the customer is mid-redirect and a slow SMS provider must
    // not hold that open. Failures land in the SMS log.
    void queueNotification(notifyOrderPaid(payment.orderId));
  }
  return completed;
}

/**
 * Finds out from TorobPay what happened to a payment, and records it.
 *
 * Safe to call any number of times, from anywhere: the return route, the
 * result page, the admin's "check status" and the background sweep.
 */
export async function confirmTorobPayPayment(payment: Payment): Promise<TorobPayOutcome> {
  const base = { orderId: payment.orderId, authority: payment.authority };

  if (payment.status === "COMPLETED") {
    return { ...base, success: true, refId: payment.refId };
  }
  if (payment.status !== "PENDING" || !payment.authority) {
    return { ...base, success: false, reason: "این پرداخت ناموفق بوده یا لغو شده است." };
  }

  const token = payment.authority;

  // verify moves W_FOR_VERIFY to W_FOR_SETTLE. It answers 1053 (wrong state)
  // when there is nothing to verify — not paid yet, already verified by an
  // earlier call, or failed — and status below tells those apart.
  try {
    await verifyTorobPay(token);
  } catch (error) {
    if (!(error instanceof TorobPayError) || error.torobCode === null) {
      logger.error({ err: error, paymentId: payment.id }, "torobpay verify could not be completed");
      return { ...base, success: false, pending: true, reason: PENDING_REASON };
    }
    if (error.torobCode !== TOROBPAY_ERROR.INVALID_ORDER_STATE) {
      logger.warn({ torobCode: error.torobCode, paymentId: payment.id }, "torobpay verify refused");
    }
  }

  let state;
  try {
    state = await getTorobPayStatus(token);
  } catch (error) {
    logger.error({ err: error, paymentId: payment.id }, "torobpay status could not be read");
    return { ...base, success: false, pending: true, reason: PENDING_REASON };
  }

  if (state.status === "REVERT") {
    const reason = "پرداخت در ترب‌پی انجام نشد یا لغو شد.";
    await markFailed(payment, reason, { torobStatus: state.rawStatus });
    return { ...base, success: false, reason };
  }

  if (state.status === "PENDING") {
    // Not finished at TorobPay: the customer may still be on its page, or our
    // verify just failed for a reason that will pass. Never recorded as a
    // failure — TorobPay itself moves an abandoned order to REVERT within
    // minutes, and the sweep picks that up. Until then the order stays
    // payable, and paying again reuses this same session.
    return {
      ...base,
      success: false,
      pending: true,
      reason: "پرداخت در ترب‌پی هنوز تکمیل نشده است. اگر پرداخت را انجام نداده‌اید، می‌توانید دوباره تلاش کنید.",
    };
  }

  if (state.status !== "VERIFY" && state.status !== "SETTLE") {
    logger.error({ paymentId: payment.id, rawStatus: state.rawStatus }, "torobpay reported an unknown status");
    return { ...base, success: false, pending: true, reason: PENDING_REASON };
  }

  // Paid — but the shop may have cancelled the order while the customer was
  // still on TorobPay's page. Completing it now would charge them for goods
  // already released back to stock, so the money goes back instead.
  const order = await prisma.order.findUnique({
    where: { id: payment.orderId },
    select: { status: true },
  });
  if (!order || order.status === "CANCELLED") {
    let reverted = false;
    try {
      await revertTorobPay(token);
      reverted = true;
    } catch (error) {
      logger.error({ err: error, paymentId: payment.id }, "torobpay revert of a cancelled order's payment failed");
    }
    const reason = "این سفارش پیش از تکمیل پرداخت لغو شده بود و مبلغ پرداخت‌شده بازگردانده می‌شود.";
    await markFailed(payment, reason, { torobStatus: state.rawStatus, orderCancelled: true, reverted });
    return { ...base, success: false, reason };
  }

  // Paid — now check it was paid for THIS order at THIS price.
  const expectedRial = tomanToRial(payment.amount);
  if (state.amountRial !== expectedRial) {
    logger.error(
      { paymentId: payment.id, expectedRial, reportedRial: state.amountRial },
      "torobpay confirmed an amount that does not match the order",
    );
    let reverted = false;
    try {
      await revertTorobPay(token);
      reverted = true;
    } catch (error) {
      logger.error({ err: error, paymentId: payment.id }, "torobpay revert after amount mismatch failed");
    }
    const reason = "مبلغ پرداخت‌شده با مبلغ سفارش مطابقت ندارد. لطفاً با پشتیبانی تماس بگیرید.";
    await markFailed(payment, reason, {
      torobStatus: state.rawStatus,
      expectedRial,
      reportedRial: state.amountRial,
      reverted,
    });
    return { ...base, success: false, reason };
  }

  if (state.status === "VERIFY") {
    // TorobPay settles on its own ten minutes later, so a failure here costs
    // nothing but a log line; it must not turn a paid order into a failed one.
    try {
      await settleTorobPay(token);
    } catch (error) {
      logger.warn({ err: error, paymentId: payment.id }, "torobpay settle failed; it will auto-settle");
    }
  }

  await markCompleted(payment, state.status);
  const refreshed = await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
  return { ...base, success: true, refId: refreshed.refId };
}

/** The customer's return from TorobPay, identified by our transactionId. */
export async function handleTorobPayReturn(transactionId: string): Promise<TorobPayOutcome> {
  const payment = await prisma.payment.findUnique({ where: { gatewayTransactionId: transactionId } });
  if (!payment || payment.gateway !== "TOROBPAY") {
    throw new NotFoundError("Payment");
  }
  return confirmTorobPayPayment(payment);
}

// ---- undoing it -----------------------------------------------------------

export interface TorobPayReversal {
  method: "REVERT" | "CANCEL" | "ALREADY_REVERTED";
  transactionId: string | null;
}

/**
 * Tells TorobPay that the shop cancelled a paid order, before the shop records
 * it as cancelled. Without this the customer keeps paying instalments on an
 * order that will never arrive.
 *
 * Throws if TorobPay refuses, so the caller can abort the cancellation and the
 * admin sees why. Returns null when there is nothing to undo at TorobPay.
 */
export async function reverseTorobPayForCancellation(payment: Payment): Promise<TorobPayReversal | null> {
  if (payment.gateway !== "TOROBPAY" || payment.status !== "COMPLETED" || !payment.authority) {
    return null;
  }
  const token = payment.authority;
  const paidAt = payment.paidAt?.getTime() ?? 0;
  const inRevertWindow = Date.now() - paidAt < TOROBPAY_REVERT_WINDOW_MS;

  if (inRevertWindow) {
    try {
      const result = await revertTorobPay(token);
      return { method: "REVERT", transactionId: result.transactionId };
    } catch (error) {
      // Our paidAt is when WE saw it paid, a little after the customer paid,
      // so the window can close on TorobPay's side first. Cancel still works.
      const code = error instanceof TorobPayError ? error.torobCode : null;
      if (code !== TOROBPAY_ERROR.TOO_LATE_FOR_REVERT && code !== TOROBPAY_ERROR.INVALID_ORDER_STATE) {
        throw error;
      }
    }
  }

  try {
    const result = await cancelTorobPay(token);
    return { method: "CANCEL", transactionId: result.transactionId };
  } catch (error) {
    // Already cancelled at TorobPay (by the customer, or an earlier attempt of
    // ours whose answer was lost): nothing left to undo.
    if (error instanceof TorobPayError && error.torobCode === TOROBPAY_ERROR.INVALID_ORDER_STATE) {
      const state = await getTorobPayStatus(token);
      if (state.status === "REVERT") return { method: "ALREADY_REVERTED", transactionId: state.transactionId };
    }
    throw error;
  }
}

// ---- admin ----------------------------------------------------------------

export interface TorobPayAdminCheck {
  status: TorobPayStatus | null;
  label: string;
  amountToman: number | null;
  transactionId: string | null;
  /** Our own record after the check, which may have just been reconciled. */
  localStatus: Payment["status"];
}

/**
 * "Check status at TorobPay" in the admin panel. For a payment still pending
 * on our side this also settles it, which rescues a customer who paid and then
 * closed the tab before coming back.
 */
export async function checkTorobPayPaymentForAdmin(paymentId: string): Promise<TorobPayAdminCheck> {
  let payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment) throw new NotFoundError("Payment");
  if (payment.gateway !== "TOROBPAY" || !payment.authority) {
    throw new BadRequestError("این پرداخت از طریق ترب‌پی انجام نشده است.");
  }

  if (payment.status === "PENDING") {
    await confirmTorobPayPayment(payment);
    payment = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
  }

  const state = await getTorobPayStatus(payment.authority!);
  return {
    status: state.status,
    label: describeTorobPayStatus(state.status, state.rawStatus),
    amountToman: state.amountRial === null ? null : Math.round(state.amountRial / 10),
    transactionId: state.transactionId,
    localStatus: payment.status,
  };
}

// ---- background reconciliation -------------------------------------------

/**
 * Settles TorobPay payments whose customer never came back.
 *
 * TorobPay moves a paid order to W_FOR_VERIFY on its own after 10 minutes if
 * the customer cannot return, then refunds it if nobody verifies within 10
 * more. Without this sweep that customer is charged, refunded, and left
 * without an order. Pending payments from the last 40 minutes are re-checked.
 */
export async function sweepPendingTorobPayPayments(): Promise<number> {
  if (!(await isTorobPayEnabled())) return 0;

  const now = Date.now();
  const pending = await prisma.payment.findMany({
    where: {
      gateway: "TOROBPAY",
      status: "PENDING",
      authority: { not: null },
      // Leave the customer a minute to come back through the normal path.
      updatedAt: { gte: new Date(now - 40 * 60 * 1000), lte: new Date(now - 60 * 1000) },
    },
    take: 50,
  });

  let settled = 0;
  for (const payment of pending) {
    try {
      const outcome = await confirmTorobPayPayment(payment);
      if (outcome.success) settled += 1;
    } catch (error) {
      logger.error({ err: error, paymentId: payment.id }, "torobpay sweep failed for a payment");
    }
  }
  if (settled > 0) logger.info({ settled }, "torobpay sweep settled payments the customer did not return from");
  return settled;
}

const SWEEP_INTERVAL_MS = 2 * 60 * 1000;

/**
 * Runs the sweep every two minutes, in one process only.
 *
 * PM2 runs the API as a cluster and numbers its workers in NODE_APP_INSTANCE;
 * only worker 0 sweeps. A second sweeper would do no harm — settlement is
 * idempotent — but it would double the calls made to TorobPay for nothing.
 */
export function startTorobPaySweep(): NodeJS.Timeout | null {
  const instance = process.env.NODE_APP_INSTANCE;
  if (instance !== undefined && instance !== "0") return null;

  let running = false;
  const timer = setInterval(() => {
    if (running) return;
    running = true;
    sweepPendingTorobPayPayments()
      .catch((error) => logger.error({ err: error }, "torobpay sweep failed"))
      .finally(() => {
        running = false;
      });
  }, SWEEP_INTERVAL_MS);
  // Never the reason the process stays alive on shutdown.
  timer.unref();
  return timer;
}
