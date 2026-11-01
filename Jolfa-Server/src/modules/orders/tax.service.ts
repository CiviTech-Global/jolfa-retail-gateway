import { prisma } from "../../shared/prisma.js";
import { logger } from "../../shared/logger.js";

/**
 * The tax added to an order, as the shop owner has set it at /admin/settings:
 * on or off, what it is called, and at what rate.
 *
 * The server is the only authority, as with delivery costs. The checkout page
 * reads the same settings to display the line, but the amount charged is always
 * worked out here. What was charged is then copied onto the order, so changing
 * the rate later leaves placed orders exactly as they were.
 */

export const TAX_SETTING_KEYS = {
  enabled: "vat_enabled",
  label: "vat_label",
  percent: "vat_percent",
} as const;

export const DEFAULT_TAX_LABEL = "مالیات بر ارزش افزوده";
export const DEFAULT_TAX_PERCENT = "9.5";

/** The width of `orders.tax_label`. */
export const TAX_LABEL_MAX_LENGTH = 100;

const BASIS_POINTS_PER_PERCENT = 100;
const BASIS_POINTS_IN_WHOLE = 10_000;

/**
 * Turns a typed percentage into basis points (9.5% is 950), or null if it is
 * not one. Whole numbers, because a rate held as a float would drift by a Toman
 * between what the checkout shows and what the server charges.
 *
 * Accepts what an admin on an RTL page really types: Persian digits, a percent
 * sign, and any of the decimal marks used in Iran, including `۹/۵`.
 */
export function parseTaxPercent(raw: string): number | null {
  const normalized = raw
    .trim()
    .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 0x06f0))
    .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 0x0660))
    .replace(/[%٪]/g, "")
    .replace(/[٫٬,/]/g, ".")
    .trim();

  if (!/^\d{1,3}(\.\d{1,2})?$/.test(normalized)) return null;

  const basisPoints = Math.round(Number(normalized) * BASIS_POINTS_PER_PERCENT);
  return basisPoints <= 100 * BASIS_POINTS_PER_PERCENT ? basisPoints : null;
}

/** The canonical stored form of a rate: 950 becomes "9.5". */
export function formatTaxPercent(basisPoints: number): string {
  return String(basisPoints / BASIS_POINTS_PER_PERCENT);
}

/** Rounded to a whole Toman. The storefront applies the same rule. */
export function calculateTax(taxableAmount: number, basisPoints: number): number {
  return Math.round((taxableAmount * basisPoints) / BASIS_POINTS_IN_WHOLE);
}

export interface TaxConfig {
  enabled: boolean;
  label: string;
  basisPoints: number;
}

/**
 * Absent rows mean off: a shop only charges tax once its owner has said so, so
 * a database that has not been seeded behaves as it always did.
 */
export async function getTaxConfig(): Promise<TaxConfig> {
  const rows = await prisma.setting.findMany({
    where: { key: { in: Object.values(TAX_SETTING_KEYS) } },
    select: { key: true, value: true },
  });
  const byKey = new Map(rows.map((row) => [row.key, row.value]));

  const rawPercent = byKey.get(TAX_SETTING_KEYS.percent) ?? DEFAULT_TAX_PERCENT;
  let basisPoints = parseTaxPercent(rawPercent);
  if (basisPoints === null) {
    // The settings route refuses this, so it took a direct database edit. The
    // owner did switch tax on, so charge the default rather than nothing.
    logger.warn({ raw: rawPercent }, "tax percent setting is unreadable; using the default");
    basisPoints = parseTaxPercent(DEFAULT_TAX_PERCENT) ?? 0;
  }

  return {
    enabled: byKey.get(TAX_SETTING_KEYS.enabled)?.trim().toLowerCase() === "true",
    label:
      byKey.get(TAX_SETTING_KEYS.label)?.trim().slice(0, TAX_LABEL_MAX_LENGTH) || DEFAULT_TAX_LABEL,
    basisPoints,
  };
}

export interface OrderTax {
  taxAmount: number;
  taxLabel: string | null;
  taxBasisPoints: number;
}

/** The tax fields of a new order. No tax leaves no trace on the order at all. */
export async function resolveOrderTax(taxableAmount: number): Promise<OrderTax> {
  const { enabled, label, basisPoints } = await getTaxConfig();
  if (!enabled || basisPoints === 0) {
    return { taxAmount: 0, taxLabel: null, taxBasisPoints: 0 };
  }
  return {
    taxAmount: calculateTax(taxableAmount, basisPoints),
    taxLabel: label,
    taxBasisPoints: basisPoints,
  };
}
