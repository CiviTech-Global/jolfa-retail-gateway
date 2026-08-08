import { Prisma } from "@prisma/client";
import { prisma } from "../../shared/prisma.js";
import { ConflictError, NotFoundError } from "../../shared/app-error.js";
import type {
  HomepageSectionCreateBody,
  HomepageSectionUpdateBody,
} from "./homepage-section.types.js";

function normalizeConfig(config?: Record<string, unknown>) {
  if (config === undefined) return Prisma.JsonNull;
  return config as Prisma.InputJsonValue;
}

export async function listActiveSections() {
  const sections = await prisma.homepageSection.findMany({
    where: { isActive: true },
    orderBy: { displayOrder: "asc" },
  });
  return { sections };
}

export async function listAllSections() {
  const sections = await prisma.homepageSection.findMany({
    orderBy: { displayOrder: "asc" },
  });
  return { sections };
}

export async function createSection(data: HomepageSectionCreateBody) {
  const existing = await prisma.homepageSection.findUnique({
    where: { key: data.key },
    select: { id: true },
  });
  if (existing) {
    throw new ConflictError("این کلید بخش قبلاً استفاده شده است");
  }

  const section = await prisma.homepageSection.create({
    data: {
      key: data.key,
      title: data.title,
      type: data.type,
      config: normalizeConfig(data.config),
      displayOrder: data.displayOrder,
      isActive: data.isActive,
    },
  });

  return { section };
}

export async function updateSection(id: string, data: HomepageSectionUpdateBody) {
  const section = await prisma.homepageSection.findUnique({ where: { id } });
  if (!section) {
    throw new NotFoundError("HomepageSection");
  }

  const updateData: Prisma.HomepageSectionUpdateInput = {};
  if (data.title !== undefined) updateData.title = data.title;
  if (data.type !== undefined) updateData.type = data.type;
  if (data.config !== undefined) updateData.config = normalizeConfig(data.config);
  if (data.displayOrder !== undefined) updateData.displayOrder = data.displayOrder;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;

  const updated = await prisma.homepageSection.update({
    where: { id },
    data: updateData,
  });

  return { section: updated };
}

export async function deleteSection(id: string) {
  const section = await prisma.homepageSection.findUnique({ where: { id } });
  if (!section) {
    throw new NotFoundError("HomepageSection");
  }

  await prisma.homepageSection.delete({ where: { id } });
  return { success: true };
}
