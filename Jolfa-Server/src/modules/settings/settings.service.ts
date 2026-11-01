import { prisma } from "../../shared/prisma.js";
import { AppError, NotFoundError } from "../../shared/app-error.js";
import { logAudit, buildChangeMetadata } from "../../shared/audit/audit.service.js";
import {
  DEFAULT_SETTINGS,
  PROTECTED_SETTING_KEYS,
  RETIRED_SETTING_KEYS,
  findSettingDefault,
} from "./settings.defaults.js";
import {
  DEFAULT_TAX_LABEL,
  TAX_LABEL_MAX_LENGTH,
  TAX_SETTING_KEYS,
  formatTaxPercent,
  parseTaxPercent,
} from "../orders/tax.service.js";
import type { SettingUpdateBody } from "./settings.types.js";

/**
 * Refuses or tidies a value that feeds customers' totals, so a typing mistake
 * is reported to the admin rather than quietly becoming a different charge. The
 * rate is stored in its plain form, because the storefront reads it as a number.
 */
function normalizeSettingValue(key: string, value: string): string {
  if (key === TAX_SETTING_KEYS.percent) {
    const basisPoints = parseTaxPercent(value);
    if (basisPoints === null) {
      throw new AppError(
        "درصد مالیات باید عددی بین ۰ تا ۱۰۰ با حداکثر دو رقم اعشار باشد.",
        400,
        "INVALID_SETTING_VALUE",
      );
    }
    return formatTaxPercent(basisPoints);
  }

  if (key === TAX_SETTING_KEYS.label) {
    const label = value.trim();
    if (label.length > TAX_LABEL_MAX_LENGTH) {
      throw new AppError(
        "نام مالیات نباید بیشتر از ۱۰۰ نویسه باشد.",
        400,
        "INVALID_SETTING_VALUE",
      );
    }
    // The name is optional; clearing it brings the default back.
    return label || DEFAULT_TAX_LABEL;
  }

  return value;
}

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

  const value = normalizeSettingValue(key, data.value);
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
        data: { value },
      })
    : await prisma.setting.create({
        data: { ...fallback!, value },
      });

  if (actorId) {
    await logAudit({
      userId: actorId,
      action: existing ? "UPDATE" : "CREATE",
      entityType: "Setting",
      entityId: setting.id,
      metadata: buildChangeMetadata({ value: existing?.value ?? "" }, { value }),
    });
  }

  return { setting };
}
