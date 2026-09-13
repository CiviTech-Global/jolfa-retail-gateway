import { prisma } from "../../shared/prisma.js";
import { BadRequestError, ConflictError, NotFoundError } from "../../shared/app-error.js";
import { env } from "../../config/env.js";
import type { PaymentGateway, PaymentStatus } from "@prisma/client";
import type { PaymentRequestBody, PaymentVerifyBody } from "./payment.types.js";
import { createTransaction } from "./transaction.service.js";
import {
  buildZibalStartUrl,
  createZibalPayment,
  describeZibalStatus,
  isPaidStatus,
  isSandbox,
  verifyZibalPayment,
} from "./zibal.client.js";
import { logger } from "../../shared/logger.js";

/**
 * Order amounts are stored in TOMAN — that is what `formatPrice` renders and
 * what the admin types in. Zibal's API is denominated in RIAL.
 *
 * Getting this wrong does not fail; it charges the customer ten times too much
 * or a tenth of the price, and both look like a working checkout. The
 * conversion is therefore a named function used at exactly one call site, not
 * a `* 10` buried in a request payload.
 */
const RIAL_PER_TOMAN = 10;

export function tomanToRial(toman: number): number {
  return toman * RIAL_PER_TOMAN;
}

export function rialToToman(rial: number): number {
  return Math.round(rial / RIAL_PER_TOMAN);
}

export interface GatewayConfig {
  gateway: PaymentGateway;
  merchantId: string;
  apiBase: string;
  /** Where the customer is redirected to pay. Must match `apiBase`'s environment. */
  startPayBase: string;
  callbackUrl: string;
}

export function getGatewayConfig(): GatewayConfig {
  const gateway: PaymentGateway = env.ZIBAL_MERCHANT_ID ? "ZIBAL" : "ZARINPAL";

  if (gateway === "ZIBAL") {
    return {
      gateway,
      merchantId: env.ZIBAL_MERCHANT_ID!,
      apiBase: "https://gateway.zibal.ir/v1",
      startPayBase: "https://gateway.zibal.ir/start",
      // Zibal requires an absolute URL starting http(s) (result code 106),
      // and it must reach THIS server rather than the SPA: the browser arrives
      // holding only a claim, and the server has to settle it with Zibal before
      // anyone is told the order is paid.
      callbackUrl:
        env.ZIBAL_CALLBACK_URL ?? `${env.APP_URL}${env.API_PREFIX}/payments/callback/zibal`,
    };
  }

  // Both of these must move together: minting an authority against the live API
  // and then sending the customer to the sandbox to pay it fails every real
  // order, and does so silently because the redirect itself looks fine.
  const sandbox = env.ZARINPAL_SANDBOX === "true";
  return {
    gateway,
    merchantId: env.ZARINPAL_MERCHANT_ID ?? (sandbox ? "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" : ""),
    apiBase: sandbox ? "https://sandbox.zarinpal.com/pg/v4" : "https://api.zarinpal.com/pg/v4",
    startPayBase: sandbox
      ? "https://sandbox.zarinpal.com/pg/StartPay"
      : "https://www.zarinpal.com/pg/StartPay",
    callbackUrl: env.ZARINPAL_CALLBACK_URL ?? `${env.API_PREFIX}/payments/verify/zarinpal`,
  };
}

export async function requestPayment(userId: string, data: PaymentRequestBody) {
  const config = getGatewayConfig();

  const order = await prisma.order.findUnique({
    where: { id: data.orderId },
    include: { payment: true },
  });

  if (!order) {
    throw new NotFoundError("Order");
  }

  if (order.userId !== userId) {
    throw new BadRequestError("این سفارش متعلق به شما نیست");
  }

  if (order.status !== "PENDING" || order.paymentStatus === "COMPLETED") {
    throw new ConflictError("وضعیت سفارش امکان پرداخت ندارد");
  }

  if (order.payment && order.payment.status === "PENDING" && order.payment.authority) {
    return {
      paymentUrl: buildPaymentUrl(config, order.payment.authority),
      authority: order.payment.authority,
    };
  }

  // Ask Zibal for a payment session BEFORE writing anything: a trackId we did
  // not receive is a payment row pointing at a session that does not exist, and
  // the customer would be redirected to a dead page.
  const customer = await prisma.user.findUnique({
    where: { id: userId },
    select: { phone: true },
  });

  const session = await createZibalPayment({
    amountRial: tomanToRial(order.finalAmount),
    callbackUrl: config.callbackUrl,
    orderId: order.orderNumber,
    description: `سفارش ${order.orderNumber}`,
    mobile: customer?.phone,
  });

  const authority = session.trackId;

  const payment = await prisma.payment.upsert({
    where: { orderId: order.id },
    update: { authority, gateway: config.gateway, amount: order.finalAmount, status: "PENDING" as PaymentStatus },
    create: {
      orderId: order.id,
      gateway: config.gateway,
      amount: order.finalAmount,
      authority,
      status: "PENDING",
    },
  });

  await createTransaction({
    orderId: order.id,
    paymentId: payment.id,
    type: "PAYMENT",
    amount: order.finalAmount,
    status: "PENDING",
    gateway: config.gateway,
    authority,
  });

  return {
    paymentUrl: buildPaymentUrl(config, authority),
    authority,
  };
}

export async function verifyPayment(data: PaymentVerifyBody) {
  if (!data.authority) {
    throw new BadRequestError("شناسه پرداخت یافت نشد");
  }

  const payment = await prisma.payment.findFirst({
    where: { authority: data.authority },
    include: { order: true },
  });

  if (!payment) {
    throw new NotFoundError("Payment");
  }

  // Already settled. Zibal would answer 201 here anyway, but there is no reason
  // to spend a round trip re-asking about a closed session.
  if (payment.status === "COMPLETED") {
    return { success: true, orderId: payment.orderId, refId: payment.refId };
  }

  // The decision is Zibal's, not the caller's.
  //
  // This used to trust the `status` field in the request body: anything other
  // than "NOK" marked the order paid. Since the customer is handed their own
  // authority by /payments/request and this endpoint needs no authentication,
  // that was a free-order button for anyone who read the network tab. The
  // callback's query string is a claim from an untrusted browser; only a verify
  // response from Zibal settles a payment.
  const result = await verifyZibalPayment(payment.authority!);

  if (!result.verified || !isPaidStatus(result.status)) {
    const reason = result.verified ? describeZibalStatus(result.status) : result.message;

    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: "FAILED",
        gatewayResponse: {
          result: result.result,
          status: result.status,
          message: result.message,
        },
      },
    });

    await createTransaction({
      orderId: payment.orderId,
      paymentId: payment.id,
      type: "PAYMENT",
      amount: payment.amount,
      status: "FAILED",
      gateway: payment.gateway,
      authority: payment.authority ?? undefined,
      metadata: { reason, result: result.result, status: result.status },
    });

    return { success: false, orderId: payment.orderId, reason };
  }

  // Zibal says paid — now check it paid for THIS order at THIS price.
  //
  // The amount is echoed back in Rial. If it does not match what we asked for,
  // something is wrong that we must not paper over by shipping goods: a mixed
  // up trackId, a tampered session, or our own Toman/Rial conversion drifting.
  const expectedRial = tomanToRial(payment.amount);
  if (result.amountRial !== null && result.amountRial !== expectedRial) {
    logger.error(
      {
        paymentId: payment.id,
        orderId: payment.orderId,
        expectedRial,
        reportedRial: result.amountRial,
      },
      "zibal verified an amount that does not match the order",
    );

    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: "FAILED",
        gatewayResponse: {
          result: result.result,
          status: result.status,
          message: "amount mismatch",
          expectedRial,
          reportedRial: result.amountRial,
        },
      },
    });

    return {
      success: false,
      orderId: payment.orderId,
      reason: "مبلغ پرداخت‌شده با مبلغ سفارش مطابقت ندارد. لطفاً با پشتیبانی تماس بگیرید.",
    };
  }

  const refId = result.refNumber ?? payment.authority!;

  await prisma.$transaction([
    prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: "COMPLETED",
        refId,
        paidAt: result.paidAt ? new Date(result.paidAt) : new Date(),
        gatewayResponse: {
          result: result.result,
          status: result.status,
          refNumber: result.refNumber,
          cardNumber: result.cardNumber,
          paidAt: result.paidAt,
          sandbox: isSandbox(),
        },
      },
    }),
    prisma.order.update({
      where: { id: payment.orderId },
      data: { paymentStatus: "COMPLETED", status: "PROCESSING" },
    }),
    prisma.transaction.create({
      data: {
        orderId: payment.orderId,
        paymentId: payment.id,
        type: "PAYMENT",
        amount: payment.amount,
        status: "COMPLETED",
        gateway: payment.gateway,
        authority: payment.authority ?? undefined,
        refId,
        metadata: {
          reason: "Verified with Zibal",
          cardNumber: result.cardNumber,
          sandbox: isSandbox(),
        },
      },
    }),
  ]);

  return { success: true, orderId: payment.orderId, refId };
}

export async function getPaymentByAuthority(authority: string) {
  const payment = await prisma.payment.findFirst({
    where: { authority },
    include: { order: { select: { id: true, orderNumber: true, status: true, paymentStatus: true } } },
  });

  if (!payment) {
    throw new NotFoundError("Payment");
  }

  return { payment };
}

/**
 * Takes the config rather than just the gateway name so the redirect can never
 * drift from the API base it was minted against.
 */
export function buildPaymentUrl(config: GatewayConfig, authority: string): string {
  if (config.gateway === "ZIBAL") {
    return buildZibalStartUrl(authority);
  }
  return `${config.startPayBase}/${authority}`;
}
