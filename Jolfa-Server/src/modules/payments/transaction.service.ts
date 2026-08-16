import { prisma } from "../../shared/prisma.js";
import { BadRequestError, NotFoundError } from "../../shared/app-error.js";
import { logAudit } from "../../shared/audit/audit.service.js";
import { Prisma } from "@prisma/client";
import type { TransactionType, TransactionStatus } from "@prisma/client";

export interface TransactionListFilters {
  page?: number;
  limit?: number;
  orderId?: string;
  paymentId?: string;
  status?: TransactionStatus;
  type?: TransactionType;
}

export async function createTransaction(input: {
  orderId?: string;
  paymentId?: string;
  type: TransactionType;
  amount: number;
  status?: TransactionStatus;
  gateway?: string;
  authority?: string;
  refId?: string;
  metadata?: Record<string, unknown>;
}) {
  return prisma.transaction.create({
    data: {
      orderId: input.orderId,
      paymentId: input.paymentId,
      type: input.type,
      amount: input.amount,
      status: input.status ?? "PENDING",
      gateway: input.gateway,
      authority: input.authority,
      refId: input.refId,
      metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
    },
  });
}

export async function listTransactions(filters: TransactionListFilters) {
  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(100, Math.max(1, filters.limit ?? 20));
  const where: Record<string, unknown> = {};

  if (filters.orderId) where.orderId = filters.orderId;
  if (filters.paymentId) where.paymentId = filters.paymentId;
  if (filters.status) where.status = filters.status;
  if (filters.type) where.type = filters.type;

  const [items, total] = await Promise.all([
    prisma.transaction.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        order: { select: { id: true, orderNumber: true } },
        payment: { select: { id: true, authority: true } },
      },
    }),
    prisma.transaction.count({ where }),
  ]);

  return {
    transactions: items,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

export async function createRefund(orderId: string, amount: number, actorId?: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { payment: true, transactions: true },
  });

  if (!order) {
    throw new NotFoundError("Order");
  }

  if (order.status === "CANCELLED") {
    throw new BadRequestError("سفارش قبلاً لغو شده است");
  }

  const completedTransactions = order.transactions.filter((t) => t.status === "COMPLETED");
  const totalPaid = completedTransactions
    .filter((t) => t.type === "PAYMENT" || t.type === "RETRY")
    .reduce((sum, t) => sum + t.amount, 0);
  const totalRefunded = completedTransactions
    .filter((t) => t.type === "REFUND")
    .reduce((sum, t) => sum + t.amount, 0);

  if (amount > totalPaid - totalRefunded) {
    throw new BadRequestError("مبلغ بازگشت بیشتر از مبلغ پرداخت‌شده است");
  }

  const transaction = await prisma.transaction.create({
    data: {
      orderId: order.id,
      paymentId: order.payment?.id,
      type: "REFUND",
      amount,
      status: "COMPLETED",
      gateway: order.payment?.gateway,
      metadata: { reason: "Admin refund" },
    },
  });

  const newPaymentStatus = totalPaid - totalRefunded - amount === 0 ? "REFUNDED" : "COMPLETED";

  await prisma.order.update({
    where: { id: order.id },
    data: { paymentStatus: newPaymentStatus },
  });

  if (actorId) {
    await logAudit({
      userId: actorId,
      action: "REFUND",
      entityType: "Transaction",
      entityId: transaction.id,
      metadata: {
        orderId,
        amount,
        paymentStatus: newPaymentStatus,
      },
    });
  }

  return transaction;
}

export async function listPaymentsForAdmin(filters: {
  page?: number;
  limit?: number;
  status?: string;
  gateway?: string;
}) {
  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(100, Math.max(1, filters.limit ?? 20));
  const where: Record<string, unknown> = {};

  if (filters.status) where.status = filters.status;
  if (filters.gateway) where.gateway = filters.gateway;

  const [items, total] = await Promise.all([
    prisma.payment.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        order: {
          select: { id: true, orderNumber: true, finalAmount: true, status: true },
        },
      },
    }),
    prisma.payment.count({ where }),
  ]);

  return {
    payments: items,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}
