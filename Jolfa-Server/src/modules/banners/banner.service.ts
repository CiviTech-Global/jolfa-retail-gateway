import { prisma } from "../../shared/prisma.js";
import { NotFoundError } from "../../shared/app-error.js";
import type { BannerCreateBody, BannerUpdateBody } from "./banner.types.js";

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

export async function createBanner(data: BannerCreateBody): Promise<{ banner: unknown }> {
  const banner = await prisma.banner.create({
    data,
    select: adminBannerSelect,
  });

  return { banner };
}

export async function updateBanner(id: string, data: BannerUpdateBody): Promise<{ banner: unknown }> {
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

  return { banner: updated };
}

export async function deleteBanner(id: string): Promise<{ success: true }> {
  const banner = await prisma.banner.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!banner) {
    throw new NotFoundError("Banner");
  }

  await prisma.banner.delete({ where: { id } });

  return { success: true };
}
