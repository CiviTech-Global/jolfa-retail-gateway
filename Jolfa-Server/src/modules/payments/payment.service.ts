import { prisma } from "../../shared/prisma.js";
import { BadRequestError, ConflictError, NotFoundError } from "../../shared/app-error.js";
import { env } from "../../config/env.js";
import type { PaymentGateway, PaymentStatus } from "@prisma/client";
import type { PaymentRequestBody, PaymentVerifyBody } from "./payment.types.js";

interface GatewayConfig {
  gateway: PaymentGateway;
  merchantId: string;
  apiBase: string;
  callbackUrl: string;
}

function getGatewayConfig(): GatewayConfig {
  const gateway: PaymentGateway = env.ZIBAL_MERCHANT_ID ? "ZIBAL" : "ZARINPAL";

  if (gateway === "ZIBAL") {
    return {
      gateway,
      merchantId: env.ZIBAL_MERCHANT_ID!,
      apiBase: "https://gateway.zibal.ir/v1",
      callbackUrl: env.ZIBAL_CALLBACK_URL ?? `${env.API_PREFIX}/payments/verify/zibal`,
    };
  }

  const sandbox = env.ZARINPAL_SANDBOX === "true";
  return {
    gateway,
    merchantId: env.ZARINPAL_MERCHANT_ID ?? (sandbox ? "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" : ""),
    apiBase: sandbox ? "https://sandbox.zarinpal.com/pg/v4" : "https://api.zarinpal.com/pg/v4",
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
      paymentUrl: buildPaymentUrl(config.gateway, order.payment.authority),
      authority: order.payment.authority,
    };
  }

  const authority = `auth-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;

  await prisma.payment.upsert({
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

  return {
    paymentUrl: buildPaymentUrl(config.gateway, authority),
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

function buildPaymentUrl(gateway: PaymentGateway, authority: string): string {
  if (gateway === "ZIBAL") {
    return `https://gateway.zibal.ir/start/${authority}`;
  }
  return `https://sandbox.zarinpal.com/pg/StartPay/${authority}`;
}
