import { z } from "zod";
import {
  imageUrl,
  nullableNumber,
  nullableString,
  optionalString,
  requiredString,
  uuidSchema,
} from "../../shared/zod-helpers.js";

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
  url: imageUrl(),
  altText: nullableString(z.string().trim().max(255, "متن جایگزین حداکثر ۲۵۵ کاراکتر است")),
  sortOrder: z.coerce.number().int().default(0),
  isPrimary: z.boolean().default(false),
});

export const productCreateBodySchema = z.object({
  title: requiredString("عنوان محصول", 200),
  slug: optionalString(
    z
      .string()
      .trim()
      .max(220, "اسلاگ حداکثر ۲۲۰ کاراکتر است")
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "اسلاگ فقط می‌تواند شامل حروف انگلیسی کوچک، عدد و خط تیره باشد"),
  ),
  description: nullableString(z.string().trim().max(10000, "توضیحات حداکثر ۱۰۰۰۰ کاراکتر است")),
  shortDescription: nullableString(z.string().trim().max(500, "توضیحات کوتاه حداکثر ۵۰۰ کاراکتر است")),
  price: z.coerce
    .number({ required_error: "قیمت الزامی است", invalid_type_error: "قیمت باید عدد باشد" })
    .int("قیمت باید عدد صحیح باشد")
    .positive("قیمت باید بیشتر از صفر باشد"),
  compareAtPrice: nullableNumber(
    z.number().int("قیمت قبل از تخفیف باید عدد صحیح باشد").positive("قیمت قبل از تخفیف باید بیشتر از صفر باشد"),
  ),
  stockQuantity: z.coerce
    .number({ invalid_type_error: "موجودی باید عدد باشد" })
    .int("موجودی باید عدد صحیح باشد")
    .nonnegative("موجودی نمی‌تواند منفی باشد")
    .default(0),
  weightGrams: nullableNumber(
    z.number().int("وزن باید عدد صحیح باشد").positive("وزن باید بیشتر از صفر باشد"),
  ),
  sku: nullableString(z.string().trim().max(100, "کد کالا حداکثر ۱۰۰ کاراکتر است")),
  categoryId: uuidSchema("دسته‌بندی"),
  isActive: z.boolean().default(true),
  isFeatured: z.boolean().default(false),
  metaTitle: nullableString(z.string().trim().max(200, "عنوان متا حداکثر ۲۰۰ کاراکتر است")),
  metaDescription: nullableString(z.string().trim().max(500, "توضیحات متا حداکثر ۵۰۰ کاراکتر است")),
  images: z.array(productImageSchema).max(10, "حداکثر ۱۰ تصویر مجاز است").default([]),
});

export const productUpdateBodySchema = productCreateBodySchema.partial();

export const productParamsSchema = z.object({
  slug: z.string().min(1),
});

export type ProductListQuery = z.infer<typeof productListQuerySchema>;
export type ProductCreateBody = z.infer<typeof productCreateBodySchema>;
export type ProductUpdateBody = z.infer<typeof productUpdateBodySchema>;
export type ProductParams = z.infer<typeof productParamsSchema>;
