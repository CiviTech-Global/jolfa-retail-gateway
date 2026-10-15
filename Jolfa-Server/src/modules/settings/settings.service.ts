import { prisma } from "../../shared/prisma.js";
import { AppError, NotFoundError } from "../../shared/app-error.js";
import { logAudit, buildChangeMetadata } from "../../shared/audit/audit.service.js";
import {
  DEFAULT_SETTINGS,
  PROTECTED_SETTING_KEYS,
  RETIRED_SETTING_KEYS,
  findSettingDefault,
} from "./settings.defaults.js";
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

  // Drop keys that no longer back anything, so an existing database does not
  // keep serving a setting the storefront stopped reading.
  await prisma.setting.deleteMany({ where: { key: { in: RETIRED_SETTING_KEYS } } });
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
    // See PROTECTED_SETTING_KEYS: these are owned by a dedicated screen with
    // its own guards, and rendering them here as plain fields would route
    // around those guards.
    where: { key: { notIn: PROTECTED_SETTING_KEYS } },
    orderBy: [{ group: "asc" }, { key: "asc" }],
  });
  return { settings };
}

export async function updateSetting(key: string, data: SettingUpdateBody, actorId?: string) {
  // Hiding these from the list is not enough on its own: the key is guessable
  // and this endpoint would otherwise accept it, which is exactly the check the
  // dedicated screen exists to perform.
  if (PROTECTED_SETTING_KEYS.includes(key)) {
    throw new AppError(
      "این تنظیم از این مسیر قابل تغییر نیست.",
      400,
      "SETTING_NOT_EDITABLE_HERE",
    );
  }

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
