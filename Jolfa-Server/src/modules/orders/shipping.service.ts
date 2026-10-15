import { prisma } from "../../shared/prisma.js";
import { logger } from "../../shared/logger.js";

/**
 * What delivery costs, per method, as the shop owner has set it.
 *
 * The two prices used to be a literal in `createOrder` and a second literal in
 * the checkout page, which meant the shop could not change its own postage
 * without a deploy, and the two copies could disagree — the customer being
 * shown one figure and charged another.
 *
 * The server stays the only authority. The checkout page reads the same
 * settings to display them, but the cost written onto the order is always
 * resolved here from the method the customer chose; a client that posts its own
 * figure is ignored.
 */

export type ShippingMethod = "POST" | "COURIER";

/**
 * Used when a setting is missing or unreadable. These are the values the shop
 * ran on before the setting existed, so a database that has not been seeded
 * behaves exactly as it did.
 */
export const SHIPPING_COST_DEFAULTS: Record<ShippingMethod, number> = {
  POST: 80_000,
  COURIER: 150_000,
};

export const SHIPPING_COST_KEYS: Record<ShippingMethod, string> = {
  POST: "shipping_cost_post",
  COURIER: "shipping_cost_courier",
};

/**
 * Turns a stored string into a usable cost.
 *
 * Settings are text, and this one is arithmetic that reaches a customer's
 * total. A blank field, a Persian numeral or a stray letter must not become
 * `NaN`: that would propagate into `finalAmount`, and Prisma would reject the
 * order with a type error the shopper reads as "checkout is broken". Anything
 * that is not a whole, non-negative number falls back to the default and says
 * so in the log.
 */
function parseCost(raw: string | undefined, method: ShippingMethod): number {
  if (raw === undefined) return SHIPPING_COST_DEFAULTS[method];

  // Persian and Arabic-Indic digits, since the admin types into an RTL page.
  const normalized = raw
    .trim()
    .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 0x06f0))
    .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 0x0660))
    // Thousands separators, both the ASCII comma and the Persian one.
    .replace(/[,٬\s]/g, "");

  if (normalized === "") return SHIPPING_COST_DEFAULTS[method];

  const value = Number(normalized);
  if (!Number.isFinite(value) || !Number.isInteger(value) || value < 0) {
    logger.warn(
      { method, raw },
      "shipping cost setting is not a whole non-negative number; using the default",
    );
    return SHIPPING_COST_DEFAULTS[method];
  }

  return value;
}

/** The cost of every method, for the checkout summary and the admin panel. */
export async function getShippingCosts(): Promise<Record<ShippingMethod, number>> {
  const rows = await prisma.setting.findMany({
    where: { key: { in: Object.values(SHIPPING_COST_KEYS) } },
    select: { key: true, value: true },
  });
  const byKey = new Map(rows.map((row) => [row.key, row.value]));

  return {
    POST: parseCost(byKey.get(SHIPPING_COST_KEYS.POST), "POST"),
    COURIER: parseCost(byKey.get(SHIPPING_COST_KEYS.COURIER), "COURIER"),
  };
}

/** The cost to charge for one order. */
export async function resolveShippingCost(method: ShippingMethod): Promise<number> {
  const costs = await getShippingCosts();
  return costs[method] ?? SHIPPING_COST_DEFAULTS.POST;
}
