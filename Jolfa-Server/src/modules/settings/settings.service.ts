import { prisma } from "../../shared/prisma.js";
import { NotFoundError } from "../../shared/app-error.js";
import { logAudit, buildChangeMetadata } from "../../shared/audit/audit.service.js";
import { DEFAULT_SETTINGS, findSettingDefault } from "./settings.defaults.js";
import type { SettingUpdateBody } from "./settings.types.js";

/**
 * Creates any missing default setting and re-aligns the metadata (group,
 * visibility, description) of rows that already exist. Admin-entered values are
 * never touched, so this is safe to run on every boot.
 */
export async function ensureDefaultSettings(): Promise<void> {
  for (const setting of DEFAULT_SETTINGS) {
    await prisma.setting.upsert({
      where: { key: setting.key },
      update: {
        group: setting.group,
        isPublic: setting.isPublic,
        description: setting.description,
      },
      create: setting,
    });
  }
}

export async function listPublicSettings() {
  const settings = await prisma.setting.findMany({
    where: { isPublic: true },
    orderBy: { group: "asc" },
    select: {
      key: true,
      value: true,
      group: true,
      description: true,
    },
  });
  return { settings };
}

export async function listAllSettings() {
  const settings = await prisma.setting.findMany({
    orderBy: [{ group: "asc" }, { key: "asc" }],
  });
  return { settings };
}

export async function updateSetting(key: string, data: SettingUpdateBody, actorId?: string) {
  const existing = await prisma.setting.findUnique({ where: { key } });

  // A known default that was never seeded is created on first write rather
  // than rejected — otherwise branding would be uneditable on a fresh install.
  const fallback = existing ? undefined : findSettingDefault(key);
  if (!existing && !fallback) {
    throw new NotFoundError("Setting");
  }

  const setting = existing
    ? await prisma.setting.update({
        where: { key },
        data: { value: data.value },
      })
    : await prisma.setting.create({
        data: { ...fallback!, value: data.value },
      });

  if (actorId) {
    await logAudit({
      userId: actorId,
      action: existing ? "UPDATE" : "CREATE",
      entityType: "Setting",
      entityId: setting.id,
      metadata: buildChangeMetadata({ value: existing?.value ?? "" }, { value: data.value }),
    });
  }

  return { setting };
}
