import { z } from "zod";

export const adminSearchQuerySchema = z.object({
  q: z.string().trim().max(120, "عبارت جستجو حداکثر ۱۲۰ کاراکتر است").default(""),
});

/** Which products a bulk price change applies to. */
const bulkPriceScopeSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("products"),
    productIds: z
      .array(z.string().uuid())
      .min(1, "حداقل یک محصول انتخاب کنید")
      .max(500, "حداکثر ۵۰۰ محصول در هر عملیات"),
  }),
  z.object({ kind: z.literal("category"), categoryId: z.string().uuid("دسته‌بندی معتبر نیست") }),
  z.object({ kind: z.literal("all") }),
]);

export const bulkPriceBodySchema = z
  .object({
    scope: bulkPriceScopeSchema,
    mode: z.enum(["percent", "fixed"], {
      errorMap: () => ({ message: "نوع تغییر باید درصدی یا مبلغ ثابت باشد" }),
    }),
    direction: z.enum(["increase", "decrease"], {
      errorMap: () => ({ message: "جهت تغییر باید افزایش یا کاهش باشد" }),
    }),
    value: z.coerce
      .number({ invalid_type_error: "مقدار تغییر باید عدد باشد" })
      .positive("مقدار تغییر باید بیشتر از صفر باشد"),
    /** Round the result to a whole multiple, e.g. 1000 Toman. */
    roundTo: z.coerce.number().int().positive().max(1_000_000).optional(),
    /** Record the old price as the struck-through "was" price. */
    setCompareAtPrice: z.boolean().default(false),
    /** Remove any struck-through price, e.g. when a sale ends. */
    clearCompareAtPrice: z.boolean().default(false),
    /**
     * Defaults to a preview. A client that forgets the flag gets a dry run,
     * never a catalogue-wide price change — the wrong default here is the one
     * that cannot be undone.
     */
    dryRun: z.boolean().default(true),
  })
  .refine((data) => !(data.setCompareAtPrice && data.clearCompareAtPrice), {
    path: ["clearCompareAtPrice"],
    message: "نمی‌توان هم‌زمان قیمت قبلی را ثبت و پاک کرد",
  })
  .refine((data) => data.mode !== "percent" || data.value <= 95, {
    path: ["value"],
    // 100% off is a free product; anything near it is almost certainly a typo
    // (95 meant as 9.5, say) rather than a real promotion.
    message: "تخفیف یا افزایش درصدی حداکثر ۹۵ درصد است",
  });

export type AdminSearchQuery = z.infer<typeof adminSearchQuerySchema>;
export type BulkPriceBody = z.infer<typeof bulkPriceBodySchema>;
