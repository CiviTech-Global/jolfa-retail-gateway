import { prisma } from "../../shared/prisma.js";
import { logger } from "../../shared/logger.js";
import { parseTomanAmount } from "./shipping.service.js";

/**
 * Flat per-order charges the shop owner sets at /admin/settings — packaging
 * and پس‌کرایه — each with its own on/off switch, name and amount.
 *
 * Same rules as delivery and tax: the server is the only authority (the
 * checkout page reads the same settings purely to display them), and what was
 * charged, name included, is copied onto the order so a later edit never
 * rewrites what a past customer paid. Not taxed: tax applies to items only.
 */

export type OrderFeeKind = "packaging" | "collectFreight";

export interface OrderFeeDefinition {
  keys: { enabled: string; label: string; amount: string };
  defaultLabel: string;
}

export const ORDER_FEES: Record<OrderFeeKind, OrderFeeDefinition> = {
  packaging: {
    keys: {
      enabled: "packaging_fee_enabled",
      label: "packaging_fee_label",
      amount: "packaging_fee_amount",
    },
    defaultLabel: "هزینه بسته‌بندی",
  },
  collectFreight: {
    keys: {
      enabled: "collect_freight_fee_enabled",
      label: "collect_freight_fee_label",
      amount: "collect_freight_fee_amount",
    },
    defaultLabel: "هزینه پس‌کرایه",
  },
};

/** The width of the label columns on `orders`. */
export const FEE_LABEL_MAX_LENGTH = 100;

export const ORDER_FEE_KINDS = Object.keys(ORDER_FEES) as OrderFeeKind[];

/** Every setting key that belongs to a fee, for validation in the settings route. */
export const ORDER_FEE_AMOUNT_KEYS = new Set(ORDER_FEE_KINDS.map((k) => ORDER_FEES[k].keys.amount));
export const ORDER_FEE_LABEL_KEYS = new Map(
  ORDER_FEE_KINDS.map((k) => [ORDER_FEES[k].keys.label, ORDER_FEES[k].defaultLabel] as const),
);

export interface OrderFeeConfig {
  enabled: boolean;
  label: string;
  amount: number;
}

export type OrderFeesConfig = Record<OrderFeeKind, OrderFeeConfig>;

/** Absent rows mean off, so an unseeded database charges exactly what it did. */
export async function getOrderFeesConfig(): Promise<OrderFeesConfig> {
  const allKeys = ORDER_FEE_KINDS.flatMap((kind) => Object.values(ORDER_FEES[kind].keys));
  const rows = await prisma.setting.findMany({
    where: { key: { in: allKeys } },
    select: { key: true, value: true },
  });
  const byKey = new Map(rows.map((row) => [row.key, row.value]));

  const read = (kind: OrderFeeKind): OrderFeeConfig => {
    const { keys, defaultLabel } = ORDER_FEES[kind];
    const rawAmount = byKey.get(keys.amount);
    let amount = parseTomanAmount(rawAmount);
    if (amount === null) {
      // The settings route refuses this, so it took a direct database edit.
      if (rawAmount !== undefined && rawAmount.trim() !== "") {
        logger.warn({ kind, raw: rawAmount }, "order fee amount is unreadable; charging nothing");
      }
      amount = 0;
    }
    return {
      enabled: byKey.get(keys.enabled)?.trim().toLowerCase() === "true",
      label: byKey.get(keys.label)?.trim().slice(0, FEE_LABEL_MAX_LENGTH) || defaultLabel,
      amount,
    };
  };

  return { packaging: read("packaging"), collectFreight: read("collectFreight") };
}

export interface OrderFees {
  packagingFee: number;
  packagingFeeLabel: string | null;
  collectFreightFee: number;
  collectFreightFeeLabel: string | null;
}

/**
 * The fee fields of a new order, from settings already read (read them before
 * the checkout transaction; see `orderTaxFor`). A fee that is off or zero
 * leaves no trace on the order.
 */
export function orderFeesFor(config: OrderFeesConfig): OrderFees {
  const pick = (fee: OrderFeeConfig) =>
    fee.enabled && fee.amount > 0 ? { amount: fee.amount, label: fee.label } : { amount: 0, label: null };
  const packaging = pick(config.packaging);
  const collectFreight = pick(config.collectFreight);
  return {
    packagingFee: packaging.amount,
    packagingFeeLabel: packaging.label,
    collectFreightFee: collectFreight.amount,
    collectFreightFeeLabel: collectFreight.label,
  };
}

export function totalOrderFees(fees: OrderFees): number {
  return fees.packagingFee + fees.collectFreightFee;
}
