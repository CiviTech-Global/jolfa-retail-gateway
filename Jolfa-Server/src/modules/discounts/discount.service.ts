import { Prisma, type DiscountCode } from "@prisma/client";
import { prisma } from "../../shared/prisma.js";
import { BadRequestError, ConflictError, NotFoundError } from "../../shared/app-error.js";
import { logAudit } from "../../shared/audit/audit.service.js";
import { normalizeDiscountCode, type DiscountCodeBody } from "./discount.types.js";

/**
 * Discount codes.
 *
 * The server is the only authority on what a code is worth, as with delivery
 * and tax: the checkout previews it, but the order is priced here, inside the
 * order's own transaction, with the code's row locked so two customers cannot
 * both take its last use.
 *
 * When is a code "used"? Once its order is paid. An order that is placed but
 * not paid holds its use for HOLD_MS, so that a customer cannot place ten
 * unpaid orders with a one-use code and pay them all, yet an abandoned
 * checkout releases the code within the hour. A cancelled order never counts.
 */

const HOLD_MS = 60 * 60 * 1000;

type Db = Prisma.TransactionClient | typeof prisma;

export function calculateDiscount(code: Pick<DiscountCode, "type" | "value" | "maxDiscountAmount">, subtotal: number): number {
  let amount =
    code.type === "PERCENT" ? Math.floor((subtotal * code.value) / 100) : code.value;
  if (code.type === "PERCENT" && code.maxDiscountAmount !== null) {
    amount = Math.min(amount, code.maxDiscountAmount);
  }
  // Never more than the items: a discount cannot make delivery free or pay
  // the customer.
  return Math.max(0, Math.min(amount, subtotal));
}

function usageWhere(codeId: string, now: Date, userId?: string, excludeOrderId?: string): Prisma.OrderWhereInput {
  return {
    discountCodeId: codeId,
    status: { not: "CANCELLED" },
    ...(userId ? { userId } : {}),
    ...(excludeOrderId ? { id: { not: excludeOrderId } } : {}),
    OR: [
      { paymentStatus: "COMPLETED" },
      { paymentStatus: "PENDING", createdAt: { gte: new Date(now.getTime() - HOLD_MS) } },
    ],
  };
}

const formatToman = (amount: number) => `${amount.toLocaleString("fa-IR")} تومان`;

/** Throws the reason, in Persian, if the code cannot be used now; checks everything but usage counts. */
function assertUsableNow(code: DiscountCode, subtotal: number, now: Date): void {
  if (!code.isActive) throw new BadRequestError("کد تخفیف معتبر نیست.");
  if (code.startsAt && code.startsAt > now) {
    throw new BadRequestError("این کد تخفیف هنوز فعال نشده است.");
  }
  if (code.expiresAt && code.expiresAt <= now) {
    throw new BadRequestError("مهلت استفاده از این کد تخفیف به پایان رسیده است.");
  }
  if (subtotal < code.minOrderAmount) {
    throw new BadRequestError(
      `این کد تخفیف برای خریدهای از ${formatToman(code.minOrderAmount)} به بالا است.`,
    );
  }
}

async function assertWithinLimits(
  db: Db,
  code: DiscountCode,
  userId: string,
  now: Date,
  excludeOrderId?: string,
): Promise<void> {
  if (code.usageLimit !== null) {
    const used = await db.order.count({ where: usageWhere(code.id, now, undefined, excludeOrderId) });
    if (used >= code.usageLimit) {
      throw new BadRequestError("ظرفیت استفاده از این کد تخفیف تکمیل شده است.");
    }
  }
  if (code.perUserLimit !== null) {
    const usedByUser = await db.order.count({ where: usageWhere(code.id, now, userId, excludeOrderId) });
    if (usedByUser >= code.perUserLimit) {
      throw new BadRequestError("شما قبلاً از این کد تخفیف استفاده کرده‌اید.");
    }
  }
}

export interface AppliedDiscount {
  discountCodeId: string;
  discountCode: string;
  discountAmount: number;
}

/**
 * Prices a code for an order being placed. Call inside the order's
 * transaction: it locks the code's row until that transaction ends, so the
 * usage counts it reads cannot change before the order is written.
 */
export async function applyDiscountCode(
  tx: Prisma.TransactionClient,
  input: { code: string; userId: string; subtotal: number },
): Promise<AppliedDiscount> {
  const normalized = normalizeDiscountCode(input.code);
  const rows = await tx.$queryRaw<{ id: string }[]>`
    SELECT id FROM discount_codes WHERE code = ${normalized} FOR UPDATE`;
  if (rows.length === 0) throw new BadRequestError("کد تخفیف معتبر نیست.");

  const code = await tx.discountCode.findUniqueOrThrow({ where: { id: rows[0].id } });
  const now = new Date();
  assertUsableNow(code, input.subtotal, now);
  await assertWithinLimits(tx, code, input.userId, now);

  return {
    discountCodeId: code.id,
    discountCode: code.code,
    discountAmount: calculateDiscount(code, input.subtotal),
  };
}

/** The checkout's "apply" button: what the code would take off this subtotal. Nothing is reserved. */
export async function previewDiscountCode(input: { code: string; userId: string; subtotal: number }) {
  const code = await prisma.discountCode.findUnique({
    where: { code: normalizeDiscountCode(input.code) },
  });
  if (!code) throw new BadRequestError("کد تخفیف معتبر نیست.");

  const now = new Date();
  assertUsableNow(code, input.subtotal, now);
  await assertWithinLimits(prisma, code, input.userId, now);

  return {
    code: code.code,
    description: code.description,
    type: code.type,
    value: code.value,
    maxDiscountAmount: code.maxDiscountAmount,
    discountAmount: calculateDiscount(code, input.subtotal),
  };
}

/**
 * Before an older unpaid order goes to the gateway: its hold has lapsed, so
 * the code may since have expired or been used up by others. Placing a new
 * order re-prices it; paying this one would not.
 */
export async function assertOrderDiscountStillValid(order: {
  id: string;
  userId: string | null;
  discountCodeId: string | null;
  createdAt: Date;
}): Promise<void> {
  if (!order.discountCodeId) return;
  const now = new Date();
  if (now.getTime() - order.createdAt.getTime() < HOLD_MS) return;

  const code = await prisma.discountCode.findUnique({ where: { id: order.discountCodeId } });
  const stale = new ConflictError(
    "کد تخفیف این سفارش دیگر معتبر نیست. لطفاً سفارش را دوباره ثبت کنید.",
  );
  if (!code || !code.isActive || (code.expiresAt && code.expiresAt <= now)) throw stale;
  try {
    await assertWithinLimits(prisma, code, order.userId ?? "", now, order.id);
  } catch {
    throw stale;
  }
}

// ---- admin ----------------------------------------------------------------

export async function listDiscountCodes() {
  const codes = await prisma.discountCode.findMany({ orderBy: { createdAt: "desc" } });
  // "Used" for the owner means paid: that is the number that cost money.
  const paid = await prisma.order.groupBy({
    by: ["discountCodeId"],
    where: {
      discountCodeId: { in: codes.map((c) => c.id) },
      paymentStatus: "COMPLETED",
      status: { not: "CANCELLED" },
    },
    _count: { _all: true },
    _sum: { discountAmount: true },
  });
  const byId = new Map(paid.map((row) => [row.discountCodeId, row]));
  return {
    discountCodes: codes.map((code) => ({
      ...code,
      paidUses: byId.get(code.id)?._count._all ?? 0,
      totalDiscountGiven: byId.get(code.id)?._sum.discountAmount ?? 0,
    })),
  };
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

const DUPLICATE = () => new ConflictError("کد تخفیفی با این نام وجود دارد.");

export async function createDiscountCode(body: DiscountCodeBody, actorId: string) {
  try {
    const code = await prisma.discountCode.create({ data: body });
    await logAudit({
      userId: actorId,
      action: "CREATE",
      entityType: "DiscountCode",
      entityId: code.id,
      metadata: { code: code.code, type: code.type, value: code.value },
    });
    return { discountCode: code };
  } catch (error) {
    if (isUniqueViolation(error)) throw DUPLICATE();
    throw error;
  }
}

export async function updateDiscountCode(id: string, body: DiscountCodeBody, actorId: string) {
  const before = await prisma.discountCode.findUnique({ where: { id } });
  if (!before) throw new NotFoundError("DiscountCode");
  try {
    // Orders keep the code text and amount they were placed with, so editing a
    // code never changes what a past customer paid.
    const code = await prisma.discountCode.update({ where: { id }, data: body });
    await logAudit({
      userId: actorId,
      action: "UPDATE",
      entityType: "DiscountCode",
      entityId: id,
      metadata: {
        code: code.code,
        before: { type: before.type, value: before.value, isActive: before.isActive },
        after: { type: code.type, value: code.value, isActive: code.isActive },
      },
    });
    return { discountCode: code };
  } catch (error) {
    if (isUniqueViolation(error)) throw DUPLICATE();
    throw error;
  }
}

export async function deleteDiscountCode(id: string, actorId: string) {
  const code = await prisma.discountCode.findUnique({ where: { id } });
  if (!code) throw new NotFoundError("DiscountCode");
  const orders = await prisma.order.count({ where: { discountCodeId: id } });
  if (orders > 0) {
    // Deleting would detach it from those orders' history and its usage
    // limits. Switching it off keeps both.
    throw new ConflictError("این کد در سفارش‌ها استفاده شده است. به جای حذف، آن را غیرفعال کنید.");
  }
  await prisma.discountCode.delete({ where: { id } });
  await logAudit({
    userId: actorId,
    action: "DELETE",
    entityType: "DiscountCode",
    entityId: id,
    metadata: { code: code.code },
  });
  return { success: true };
}
