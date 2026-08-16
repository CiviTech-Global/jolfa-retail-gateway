import { Prisma } from "@prisma/client";
import { prisma } from "../../shared/prisma.js";
import { ConflictError, NotFoundError } from "../../shared/app-error.js";
import { logAudit, buildChangeMetadata } from "../../shared/audit/audit.service.js";
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

export async function createSectionWithAudit(
  data: HomepageSectionCreateBody,
  actorId?: string,
) {
  const result = await createSection(data);
  if (actorId) {
    await logAudit({
      userId: actorId,
      action: "CREATE",
      entityType: "HomepageSection",
      entityId: result.section.id,
      metadata: { key: result.section.key, title: result.section.title },
    });
  }
  return result;
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

export async function updateSectionWithAudit(
  id: string,
  data: HomepageSectionUpdateBody,
  actorId?: string,
) {
  const existing = await prisma.homepageSection.findUnique({ where: { id } });
  const before = existing
    ? { title: existing.title, isActive: existing.isActive, displayOrder: existing.displayOrder }
    : {};

  const result = await updateSection(id, data);

  if (actorId) {
    await logAudit({
      userId: actorId,
      action: "UPDATE",
      entityType: "HomepageSection",
      entityId: id,
      metadata: buildChangeMetadata(before, {
        title: result.section.title,
        isActive: result.section.isActive,
        displayOrder: result.section.displayOrder,
      }),
    });
  }

  return result;
}

export async function deleteSection(id: string, actorId?: string) {
  const section = await prisma.homepageSection.findUnique({ where: { id } });
  if (!section) {
    throw new NotFoundError("HomepageSection");
  }

  await prisma.homepageSection.delete({ where: { id } });

  if (actorId) {
    await logAudit({
      userId: actorId,
      action: "DELETE",
      entityType: "HomepageSection",
      entityId: id,
      metadata: { key: section.key, title: section.title },
    });
  }

  return { success: true };
}
