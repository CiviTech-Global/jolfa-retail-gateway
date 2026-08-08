import { z } from "zod";

export const productListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(24),
  categorySlug: z.string().optional().or(z.literal("").transform(() => undefined)),
  q: z.string().optional().or(z.literal("").transform(() => undefined)),
  sort: z.enum(["price:asc", "price:desc", "createdAt:desc", "createdAt:asc"]).default("createdAt:desc"),
  minPrice: z.coerce.number().int().nonnegative().optional(),
  maxPrice: z.coerce.number().int().nonnegative().optional(),
  featured: z
    .union([z.boolean(), z.string()])
    .transform((value) => {
      if (typeof value === "boolean") return value;
      return ["true", "1", "yes", "on"].includes(value.toLowerCase());
    })
    .optional(),
});

export const productImageSchema = z.object({
  url: z.string().min(1).max(500),
  altText: z.string().max(255).optional().or(z.literal("").transform(() => undefined)),
  sortOrder: z.coerce.number().int().default(0),
  isPrimary: z.boolean().default(false),
});

export const productCreateBodySchema = z.object({
  title: z.string().min(1).max(200),
  slug: z.string().min(1).max(220).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(),
  description: z.string().max(10000).optional().or(z.literal("").transform(() => undefined)),
  shortDescription: z.string().max(500).optional().or(z.literal("").transform(() => undefined)),
  price: z.coerce.number().int().positive(),
  compareAtPrice: z.coerce.number().int().positive().optional(),
  stockQuantity: z.coerce.number().int().nonnegative().default(0),
  weightGrams: z.coerce.number().int().positive().optional(),
  sku: z.string().max(100).optional().or(z.literal("").transform(() => undefined)),
  categoryId: z.string().uuid(),
  isActive: z.boolean().default(true),
  isFeatured: z.boolean().default(false),
  metaTitle: z.string().max(200).optional().or(z.literal("").transform(() => undefined)),
  metaDescription: z.string().max(500).optional().or(z.literal("").transform(() => undefined)),
  images: z.array(productImageSchema).max(10).default([]),
});

export const productUpdateBodySchema = productCreateBodySchema.partial();

export const productParamsSchema = z.object({
  slug: z.string().min(1),
});

export type ProductListQuery = z.infer<typeof productListQuerySchema>;
export type ProductCreateBody = z.infer<typeof productCreateBodySchema>;
export type ProductUpdateBody = z.infer<typeof productUpdateBodySchema>;
export type ProductParams = z.infer<typeof productParamsSchema>;
