import { prisma } from "../../shared/prisma.js";
import { NotFoundError } from "../../shared/app-error.js";
import { logAudit, buildChangeMetadata } from "../../shared/audit/audit.service.js";
import type { UserListQuery, UserRoleUpdateBody, UserStatusUpdateBody } from "./user.types.js";

const USER_PUBLIC_SELECT = {
  id: true,
  email: true,
  phone: true,
  firstName: true,
  lastName: true,
  role: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const;

export async function listUsers(query: UserListQuery) {
  const page = query.page;
  const limit = query.limit;
  const where: Record<string, unknown> = {};

  if (query.role) where.role = query.role;
  if (query.isActive !== undefined) where.isActive = query.isActive === "true";
  if (query.q) {
    where.OR = [
      { phone: { contains: query.q, mode: "insensitive" } },
      { email: { contains: query.q, mode: "insensitive" } },
      { firstName: { contains: query.q, mode: "insensitive" } },
      { lastName: { contains: query.q, mode: "insensitive" } },
    ];
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: USER_PUBLIC_SELECT,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.user.count({ where }),
  ]);

  return {
    users,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

export async function updateUserRole(
  id: string,
  body: UserRoleUpdateBody,
  actorId?: string,
) {
  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError("User");
  }

  const before = { role: existing.role };
  const user = await prisma.user.update({
    where: { id },
    data: { role: body.role },
    select: USER_PUBLIC_SELECT,
  });

  if (actorId) {
    await logAudit({
      userId: actorId,
      action: "UPDATE",
      entityType: "User",
      entityId: id,
      metadata: buildChangeMetadata(before, { role: body.role }),
    });
  }

  return user;
}

export async function updateUserStatus(
  id: string,
  body: UserStatusUpdateBody,
  actorId?: string,
) {
  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError("User");
  }

  const before = { isActive: existing.isActive };
  const user = await prisma.user.update({
    where: { id },
    data: { isActive: body.isActive },
    select: USER_PUBLIC_SELECT,
  });

  if (actorId) {
    await logAudit({
      userId: actorId,
      action: "UPDATE",
      entityType: "User",
      entityId: id,
      metadata: buildChangeMetadata(before, { isActive: body.isActive }),
    });
  }

  return user;
}
