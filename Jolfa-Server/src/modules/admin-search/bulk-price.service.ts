import type { Prisma } from "@prisma/client";
import { prisma } from "../../shared/prisma.js";
import { AppError } from "../../shared/app-error.js";
import { logAudit } from "../../shared/audit/audit.service.js";
import { logger } from "../../shared/logger.js";
import type { BulkPriceBody } from "./admin-search.types.js";

/**
 * Change the price of many products at once.
 *
 * This is the most destructive thing in the admin panel: one click can rewrite
 * every price in the shop, and there is no per-product undo. Three things guard
 * it, and none of them are optional.
 *
 * 1. Every request is a dry run unless it explicitly says otherwise, and the UI
 *    shows the preview before the apply button appears. "How many rows will
 *    this touch" must be answerable before, not after.
 * 2. Prices are clamped to a floor. A 90% discount applied twice reaches zero,
 *    and a zero-price product is an order the shop fulfils for nothing.
 * 3. The whole operation is one audit entry with its parameters, so a wrong
 *    bulk change can be recognised and reasoned about afterwards.
 */

/**
 * No product may drop below this (Toman).
 *
 * Also keeps every price above Zibal's minimum transaction amount, so a
 * discounted cart cannot become a payment the gateway refuses.
 */
const MIN_PRICE = 1_000;

export interface BulkPriceChange {
  id: string;
  title: string;
  before: number;
  after: number;
}

export interface BulkPriceResult {
  dryRun: boolean;
  /** Products the scope selected. */
  matched: number;
  /** Products whose price actually changes. */
  changed: number;
  /** Products left at the floor instead of going lower. */
  clamped: number;
  sample: BulkPriceChange[];
  totalBefore: number;
  totalAfter: number;
}

function buildWhere(scope: BulkPriceBody["scope"]): Prisma.ProductWhereInput {
  switch (scope.kind) {
    case "products":
      return { id: { in: scope.productIds } };
    case "category":
      // Includes the whole subtree: selecting a top-level category means "and
      // everything under it", which is how an admin thinks about a category.
      return {
        OR: [{ categoryId: scope.categoryId }, { category: { parentId: scope.categoryId } }],
      };
    case "all":
      return {};
  }
}

/** Applies the adjustment to one price, rounding and clamping. */
export function adjustPrice(
  price: number,
  body: Pick<BulkPriceBody, "mode" | "direction" | "value" | "roundTo">,
): number {
  const delta = body.mode === "percent" ? (price * body.value) / 100 : body.value;
  const raw = body.direction === "increase" ? price + delta : price - delta;

  // Rounding to a whole unit (1,000 Toman, say) is what keeps a catalogue from
  // filling with prices like 87,431 after a percentage change.
  const rounded =
    body.roundTo && body.roundTo > 1 ? Math.round(raw / body.roundTo) * body.roundTo : Math.round(raw);

  return Math.max(MIN_PRICE, rounded);
}

export async function bulkAdjustPrices(
  body: BulkPriceBody,
  actorId: string,
): Promise<BulkPriceResult> {
  const where = buildWhere(body.scope);

  const products = await prisma.product.findMany({
    where,
    select: { id: true, title: true, price: true, compareAtPrice: true },
    orderBy: { title: "asc" },
  });

  if (products.length === 0) {
    throw new AppError("هیچ محصولی با این شرایط پیدا نشد", 400, "BULK_PRICE_EMPTY_SCOPE");
  }

  const changes: { id: string; title: string; before: number; after: number; clamped: boolean }[] =
    products.map((product) => {
      const after = adjustPrice(product.price, body);
      return {
        id: product.id,
        title: product.title,
        before: product.price,
        after,
        // Only counts as clamped if the floor is what stopped it going lower.
        clamped: after === MIN_PRICE && after !== product.price && body.direction === "decrease",
      };
    });

  const effective = changes.filter((change) => change.after !== change.before);

  const result: BulkPriceResult = {
    dryRun: body.dryRun,
    matched: products.length,
    changed: effective.length,
    clamped: changes.filter((change) => change.clamped).length,
    sample: effective.slice(0, 20).map(({ id, title, before, after }) => ({
      id,
      title,
      before,
      after,
    })),
    totalBefore: changes.reduce((sum, change) => sum + change.before, 0),
    totalAfter: changes.reduce((sum, change) => sum + change.after, 0),
  };

  if (body.dryRun || effective.length === 0) {
    return result;
  }

  const priceById = new Map(products.map((product) => [product.id, product]));

  // One transaction: a bulk change that half-applied would leave the catalogue
  // in a state nobody can describe, let alone reverse.
  await prisma.$transaction(
    effective.map((change) => {
      const product = priceById.get(change.id);
      // Showing the old price struck through is the point of a sale, but it is
      // only honest while the product is actually discounted — and it must not
      // overwrite a compareAtPrice the shop already set by hand.
      const setCompareAt =
        body.setCompareAtPrice && body.direction === "decrease" && !product?.compareAtPrice;

      return prisma.product.update({
        where: { id: change.id },
        data: {
          price: change.after,
          ...(setCompareAt ? { compareAtPrice: change.before } : {}),
          ...(body.clearCompareAtPrice ? { compareAtPrice: null } : {}),
        },
      });
    }),
  );

  logger.info(
    {
      actorId,
      scope: body.scope.kind,
      mode: body.mode,
      direction: body.direction,
      value: body.value,
      changed: result.changed,
    },
    "bulk price adjustment applied",
  );

  // One entry for the operation, not one per product: a thousand rows would
  // bury every other action in the log and still not say what was intended.
  await logAudit({
    userId: actorId,
    action: "UPDATE",
    entityType: "Product",
    entityId: products[0].id,
    metadata: {
      bulkPriceAdjustment: true,
      scope: body.scope,
      mode: body.mode,
      direction: body.direction,
      value: body.value,
      roundTo: body.roundTo ?? null,
      matched: result.matched,
      changed: result.changed,
      clamped: result.clamped,
      totalBefore: result.totalBefore,
      totalAfter: result.totalAfter,
    },
  });

  return result;
}
