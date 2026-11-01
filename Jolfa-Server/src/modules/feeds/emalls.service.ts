import { env } from "../../config/env.js";
import { prisma } from "../../shared/prisma.js";
import { absoluteUrl } from "../product-page/product-page.service.js";
import type { Prisma } from "@prisma/client";
import type { EmallsQuery } from "./emalls.types.js";

/**
 * The product list Emalls reads, in the shape of its merchant guide.
 *
 * Emalls chooses the page and page size and we answer in its field names, so
 * this is deliberately not the API's usual `{ success, data }` envelope. Prices
 * are Toman. Emalls requires an image on every product, so a product without
 * one stays out of the list until it has one: leaving it in would send an entry
 * Emalls cannot use, and could put the rest of the page at risk.
 */

export interface EmallsProduct {
  title: string;
  id: string;
  price: number;
  old_price?: number;
  category: string;
  image: string;
  guarantee?: string;
  is_available: boolean;
  url: string;
}

export interface EmallsResponse {
  success: true;
  products: EmallsProduct[];
  total_items: number;
  pages_count: number;
  item_per_page: number;
  page_num: number;
}

const LISTED: Prisma.ProductWhereInput = { isActive: true, images: { some: {} } };

export async function listEmallsProducts(query: EmallsQuery): Promise<EmallsResponse> {
  const { page, item_per_page: perPage } = query;

  const [products, totalItems, defaultGuarantee] = await Promise.all([
    prisma.product.findMany({
      where: LISTED,
      // Includes the id: pages must not overlap or skip a product just because
      // two were created in the same instant.
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * perPage,
      take: perPage,
      select: {
        id: true,
        title: true,
        slug: true,
        price: true,
        compareAtPrice: true,
        stockQuantity: true,
        guarantee: true,
        category: { select: { name: true } },
        images: {
          orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }],
          select: { url: true },
          take: 1,
        },
      },
    }),
    prisma.product.count({ where: LISTED }),
    prisma.setting.findUnique({ where: { key: "default_guarantee" }, select: { value: true } }),
  ]);

  const siteUrl = env.APP_URL.replace(/\/+$/, "");

  return {
    success: true,
    products: products.map((product) => {
      const guarantee = product.guarantee?.trim() || defaultGuarantee?.value.trim();
      const hasDiscount =
        product.compareAtPrice !== null && product.compareAtPrice > product.price;

      return {
        title: product.title,
        id: product.id,
        price: product.price,
        ...(hasDiscount ? { old_price: product.compareAtPrice as number } : {}),
        category: product.category.name,
        // Always present: LISTED excludes products with no image.
        image: absoluteUrl(product.images[0]!.url),
        ...(guarantee ? { guarantee } : {}),
        is_available: product.stockQuantity > 0,
        url: `${siteUrl}/products/${encodeURIComponent(product.slug)}`,
      };
    }),
    total_items: totalItems,
    pages_count: Math.ceil(totalItems / perPage),
    item_per_page: perPage,
    page_num: page,
  };
}
