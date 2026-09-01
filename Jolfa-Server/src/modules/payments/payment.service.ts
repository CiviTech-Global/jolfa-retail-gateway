import { prisma } from "../../shared/prisma.js";
import { BadRequestError, ConflictError, NotFoundError } from "../../shared/app-error.js";
import { env } from "../../config/env.js";
import type { PaymentGateway, PaymentStatus } from "@prisma/client";
import type { PaymentRequestBody, PaymentVerifyBody } from "./payment.types.js";
import { createTransaction } from "./transaction.service.js";

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
      callbackUrl: env.ZIBAL_CALLBACK_URL ?? `${env.API_PREFIX}/payments/verify/zibal`,
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

  const authority = `auth-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;

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

  if (payment.status === "COMPLETED") {
    return { success: true, orderId: payment.orderId, refId: payment.refId };
  }

  if (data.status === "NOK") {
    await prisma.payment.update({
      where: { id: payment.id },
      data: { status: "FAILED", gatewayResponse: { status: "NOK" } },
    });
    await createTransaction({
      orderId: payment.orderId,
      paymentId: payment.id,
      type: "PAYMENT",
      amount: payment.amount,
      status: "FAILED",
      gateway: payment.gateway,
      authority: payment.authority ?? undefined,
      metadata: { reason: "NOK callback" },
    });
    return { success: false, orderId: payment.orderId };
  }

  const refId = `ref-${Date.now()}`;

  await prisma.$transaction([
    prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: "COMPLETED",
        refId,
        paidAt: new Date(),
        gatewayResponse: { status: "OK", refId },
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
        metadata: { reason: "Payment verified" },
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
  return `${config.startPayBase}/${authority}`;
}
