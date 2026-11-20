import { z } from "zod";

/**
 * Codes are stored and compared in one canonical form, so "summer-1405",
 * "SUMMER-1405" and "SUMMER-۱۴۰۵" typed on a Persian keyboard are one code.
 */
export function normalizeDiscountCode(raw: string): string {
  return raw
    .trim()
    .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 0x06f0))
    .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 0x0660))
    .replace(/\s+/g, "")
    .toUpperCase();
}

export const DISCOUNT_CODE_PATTERN = /^[A-Z0-9_-]{3,30}$/;

const codeSchema = z
  .string({ error: "کد تخفیف الزامی است" })
  .transform(normalizeDiscountCode)
  .refine((code) => DISCOUNT_CODE_PATTERN.test(code), {
    message: "کد تخفیف باید ۳ تا ۳۰ حرف انگلیسی، عدد، - یا _ باشد",
  });

const optionalPositiveInt = (label: string) =>
  z
    .number({ error: `${label} باید عدد باشد` })
    .int(`${label} باید عدد صحیح باشد`)
    .positive(`${label} باید بیشتر از صفر باشد`)
    .nullable()
    .optional()
    .transform((value) => value ?? null);

const optionalDate = z
  .union([z.iso.datetime({ offset: true }), z.iso.date(), z.null()])
  .optional()
  .transform((value) => (value ? new Date(value) : null));

/** The whole definition of a code: used for both create and edit. */
export const discountCodeBodySchema = z
  .object({
    code: codeSchema,
    description: z
      .string()
      .trim()
      .max(200, "توضیح حداکثر ۲۰۰ کاراکتر است")
      .nullable()
      .optional()
      .transform((value) => value || null),
    type: z.enum(["PERCENT", "FIXED"], { error: "نوع تخفیف معتبر نیست" }),
    value: z
      .number({ error: "مقدار تخفیف باید عدد باشد" })
      .int("مقدار تخفیف باید عدد صحیح باشد")
      .positive("مقدار تخفیف باید بیشتر از صفر باشد"),
    maxDiscountAmount: optionalPositiveInt("سقف تخفیف"),
    minOrderAmount: z
      .number({ error: "حداقل مبلغ خرید باید عدد باشد" })
      .int()
      .nonnegative("حداقل مبلغ خرید نمی‌تواند منفی باشد")
      .default(0),
    startsAt: optionalDate,
    expiresAt: optionalDate,
    usageLimit: optionalPositiveInt("سقف کل استفاده"),
    // Omitted means once per customer, the safe default; null means unlimited.
    perUserLimit: z
      .number({ error: "سقف استفاده هر مشتری باید عدد باشد" })
      .int("سقف استفاده هر مشتری باید عدد صحیح باشد")
      .positive("سقف استفاده هر مشتری باید بیشتر از صفر باشد")
      .nullable()
      .default(1),
    isActive: z.boolean().default(true),
  })
  .refine((data) => data.type !== "PERCENT" || data.value <= 100, {
    path: ["value"],
    message: "درصد تخفیف حداکثر ۱۰۰ است",
  })
  .refine((data) => !data.startsAt || !data.expiresAt || data.expiresAt > data.startsAt, {
    path: ["expiresAt"],
    message: "تاریخ پایان باید بعد از تاریخ شروع باشد",
  });

export type DiscountCodeBody = z.output<typeof discountCodeBodySchema>;

export const discountCodeParamsSchema = z.object({ id: z.guid() });

/** A customer checking a code at checkout. `subtotal` is the items total in Toman. */
export const discountValidateBodySchema = z.object({
  code: z.string().trim().min(1, "کد تخفیف را وارد کنید").max(50),
  subtotal: z.number().int().nonnegative(),
});

export type DiscountValidateBody = z.infer<typeof discountValidateBodySchema>;
