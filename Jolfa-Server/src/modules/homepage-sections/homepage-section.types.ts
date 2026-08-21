import { z } from "zod";

/**
 * Known homepage section types. Kept in sync with Jolfa-web's
 * `features/cms/section-registry.ts`. Legacy type strings (`hero`,
 * `categories`, `discounted`, `promo_banner`) are retained so existing
 * seeded/customer data keeps rendering via the frontend's fallback dispatch.
 */
export const KNOWN_SECTION_TYPES = [
  "hero",
  "hero_carousel",
  "categories",
  "category_grid",
  "featured_products",
  "new_products",
  "discounted",
  "promo_banner",
  "product_carousel",
  "flash_deals",
  "banner_grid",
  "brand_strip",
  "trust_badges",
  "blog_teaser",
  "app_download",
  "newsletter",
] as const;

const sectionTypeSchema = z
  .string()
  .min(1)
  .max(50)
  .refine((value) => (KNOWN_SECTION_TYPES as readonly string[]).includes(value), {
    message: `type must be one of: ${KNOWN_SECTION_TYPES.join(", ")}`,
  });

export const homepageSectionCreateSchema = z.object({
  key: z.string().min(1).max(100),
  title: z.string().min(1).max(200),
  type: sectionTypeSchema,
  config: z.record(z.unknown()).optional(),
  displayOrder: z.number().int().default(0),
  isActive: z.boolean().default(true),
});

export const homepageSectionUpdateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  type: sectionTypeSchema.optional(),
  config: z.record(z.unknown()).optional(),
  displayOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

export const homepageSectionParamsSchema = z.object({
  id: z.string().uuid(),
});

export type HomepageSectionCreateBody = z.infer<typeof homepageSectionCreateSchema>;
export type HomepageSectionUpdateBody = z.infer<typeof homepageSectionUpdateSchema>;
export type HomepageSectionParams = z.infer<typeof homepageSectionParamsSchema>;
