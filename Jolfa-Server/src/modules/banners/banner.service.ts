import { prisma } from "../../shared/prisma.js";
import { NotFoundError } from "../../shared/app-error.js";
import { logAudit, buildChangeMetadata } from "../../shared/audit/audit.service.js";
import type { BannerCreateBody, BannerUpdateBody } from "./banner.types.js";

interface BannerAdminDto {
  id: string;
  title: string;
  subtitle: string | null;
  imageUrl: string;
  link: string | null;
  position: string;
  displayOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const publicBannerSelect = {
  id: true,
  title: true,
  subtitle: true,
  imageUrl: true,
  link: true,
  position: true,
  displayOrder: true,
  isActive: true,
};

const adminBannerSelect = {
  id: true,
  title: true,
  subtitle: true,
  imageUrl: true,
  link: true,
  position: true,
  displayOrder: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
};

export async function listBanners(position?: string): Promise<{ banners: unknown[] }> {
  const where = {
    isActive: true,
    ...(position ? { position } : {}),
  };

  const banners = await prisma.banner.findMany({
    where,
    orderBy: [{ displayOrder: "asc" }, { createdAt: "desc" }],
    select: publicBannerSelect,
  });

  return { banners };
}

export async function listAllBanners(): Promise<{ banners: unknown[] }> {
  const banners = await prisma.banner.findMany({
    orderBy: [{ position: "asc" }, { displayOrder: "asc" }, { createdAt: "desc" }],
    select: adminBannerSelect,
  });

  return { banners };
}

export async function createBanner(data: BannerCreateBody): Promise<{ banner: BannerAdminDto }> {
  const banner = await prisma.banner.create({
    data,
    select: adminBannerSelect,
  });

  return { banner: banner as BannerAdminDto };
}

export async function createBannerWithAudit(data: BannerCreateBody, actorId?: string) {
  const result = await createBanner(data);
  if (actorId) {
    await logAudit({
      userId: actorId,
      action: "CREATE",
      entityType: "Banner",
      entityId: result.banner.id,
      metadata: { title: result.banner.title },
    });
  }
  return result;
}

export async function updateBanner(id: string, data: BannerUpdateBody): Promise<{ banner: BannerAdminDto }> {
  const banner = await prisma.banner.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!banner) {
    throw new NotFoundError("Banner");
  }

  const updated = await prisma.banner.update({
    where: { id },
    data,
    select: adminBannerSelect,
  });

  return { banner: updated as BannerAdminDto };
}

export async function updateBannerWithAudit(
  id: string,
  data: BannerUpdateBody,
  actorId?: string,
) {
  const existing = await prisma.banner.findUnique({ where: { id } });
  const before = existing
    ? { title: existing.title, isActive: existing.isActive, position: existing.position }
    : {};

  const result = await updateBanner(id, data);

  if (actorId) {
    await logAudit({
      userId: actorId,
      action: "UPDATE",
      entityType: "Banner",
      entityId: id,
      metadata: buildChangeMetadata(before, {
        title: result.banner.title,
        isActive: result.banner.isActive,
        position: result.banner.position,
      }),
    });
  }

  return result;
}

export async function deleteBanner(id: string, actorId?: string): Promise<{ success: true }> {
  const banner = await prisma.banner.findUnique({
    where: { id },
    select: { id: true, title: true },
  });

  if (!banner) {
    throw new NotFoundError("Banner");
  }

  await prisma.banner.delete({ where: { id } });

  if (actorId) {
    await logAudit({
      userId: actorId,
      action: "DELETE",
      entityType: "Banner",
      entityId: id,
      metadata: { title: banner.title },
    });
  }

  return { success: true };
}
