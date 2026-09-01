import { z } from "zod";
import { imageUrl, nullableString, requiredString } from "../../shared/zod-helpers.js";

export const bannerListQuerySchema = z.object({
  position: z.string().max(50).optional().or(z.literal("").transform(() => undefined)),
});

export const BANNER_POSITIONS = ["hero", "sidebar", "footer", "promo"] as const;

export const bannerCreateBodySchema = z.object({
  title: requiredString("عنوان بنر", 200),
  subtitle: nullableString(z.string().trim().max(500, "زیرعنوان حداکثر ۵۰۰ کاراکتر است")),
  imageUrl: imageUrl("تصویر بنر الزامی است"),
  link: nullableString(
    z
      .string()
      .trim()
      .max(500, "لینک حداکثر ۵۰۰ کاراکتر است")
      .refine(
        (value) => value.startsWith("/") || /^https?:\/\//i.test(value),
        "لینک باید با / یا http شروع شود",
      ),
  ),
  position: z
    .enum(BANNER_POSITIONS, {
      errorMap: () => ({ message: "موقعیت انتخاب‌شده معتبر نیست" }),
    })
    .default("hero"),
  displayOrder: z.coerce
    .number({ invalid_type_error: "ترتیب نمایش باید عدد باشد" })
    .int("ترتیب نمایش باید عدد صحیح باشد")
    .default(0),
  isActive: z.boolean().default(true),
});

export const bannerUpdateBodySchema = bannerCreateBodySchema.partial();

export const bannerParamsSchema = z.object({
  id: z.string().uuid("شناسه بنر معتبر نیست"),
});

export type BannerListQuery = z.infer<typeof bannerListQuerySchema>;
export type BannerCreateBody = z.infer<typeof bannerCreateBodySchema>;
export type BannerUpdateBody = z.infer<typeof bannerUpdateBodySchema>;
export type BannerParams = z.infer<typeof bannerParamsSchema>;
