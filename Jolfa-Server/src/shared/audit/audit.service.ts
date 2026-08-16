import { prisma } from "../prisma.js";
import { Prisma } from "@prisma/client";

export type AuditAction =
  | "CREATE"
  | "UPDATE"
  | "DELETE"
  | "STATUS_CHANGE"
  | "LOGIN"
  | "LOGOUT"
  | "UPLOAD"
  | "REFUND"
  | "CANCEL";

export type AuditEntityType =
  | "Product"
  | "Category"
  | "Order"
  | "Banner"
  | "Setting"
  | "HomepageSection"
  | "User"
  | "Payment"
  | "Transaction"
  | "Upload";

export interface AuditLogInput {
  userId?: string;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

export async function logAudit(input: AuditLogInput) {
  try {
    await prisma.auditLog.create({
      data: {
        userId: input.userId,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
      },
    });
  } catch (error) {
    console.error("Failed to write audit log", error);
  }
}

export function buildChangeMetadata<T extends Record<string, unknown>>(
  before: T,
  after: T,
): Record<string, unknown> {
  return {
    before: sanitizeForLog(before),
    after: sanitizeForLog(after),
  };
}

function sanitizeForLog(value: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value)) {
    if (typeof val === "bigint") {
      sanitized[key] = Number(val);
    } else if (val instanceof Date) {
      sanitized[key] = val.toISOString();
    } else {
      sanitized[key] = val;
    }
  }
  return sanitized;
}

export interface AuditLogListFilters {
  page?: number;
  limit?: number;
  entityType?: string;
  entityId?: string;
  userId?: string;
  action?: string;
  from?: string;
  to?: string;
}

export async function listAuditLogs(filters: AuditLogListFilters) {
  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(100, Math.max(1, filters.limit ?? 20));
  const where: Record<string, unknown> = {};

  if (filters.entityType) where.entityType = filters.entityType;
  if (filters.entityId) where.entityId = filters.entityId;
  if (filters.userId) where.userId = filters.userId;
  if (filters.action) where.action = filters.action;
  if (filters.from || filters.to) {
    where.createdAt = {};
    if (filters.from) (where.createdAt as Record<string, Date>).gte = new Date(filters.from);
    if (filters.to) (where.createdAt as Record<string, Date>).lte = new Date(filters.to);
  }

  const [items, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, phone: true },
        },
      },
    }),
    prisma.auditLog.count({ where }),
  ]);

  return {
    items,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}
