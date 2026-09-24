import { z } from "zod";
import { imageUrl as imageUrlSchema, nullableString } from "../../shared/zod-helpers.js";

/**
 * Blocks an admin can put on a content page.
 *
 * Every block is a closed, typed shape rather than a blob of HTML. An admin
 * with a rich-text field that stores markup is a stored-XSS hole on a page
 * every visitor loads, and it also means the page can be broken into something
 * the design cannot render. Here the admin supplies words and the storefront
 * supplies the markup, so neither can happen.
 *
 * Text keeps its newlines and is rendered with `whitespace-pre-line`, which
 * covers the paragraph breaks that prose actually needs.
 */

const blockId = z
  .string()
  .trim()
  .min(1, "شناسه بلوک الزامی است")
  .max(64, "شناسه بلوک حداکثر ۶۴ کاراکتر است");

/** Icons the storefront can draw. A free-text icon name would render nothing. */
export const CONTENT_ICONS = [
  "store",
  "leaf",
  "truck",
  "shield",
  "heart",
  "sparkles",
  "headphones",
  "package",
  "clock",
  "award",
  "phone",
  "mail",
  "map_pin",
  "credit_card",
  "refresh",
  "alert",
] as const;

const iconSchema = z.enum(CONTENT_ICONS, {
  errorMap: () => ({ message: "آیکن انتخاب‌شده معتبر نیست" }),
});

const headingBlock = z.object({
  id: blockId,
  type: z.literal("heading"),
  text: z.string().trim().min(1, "عنوان الزامی است").max(200, "عنوان حداکثر ۲۰۰ کاراکتر است"),
  subtitle: nullableString(z.string().trim().max(600, "زیرعنوان حداکثر ۶۰۰ کاراکتر است")),
  align: z.enum(["start", "center"]).default("center"),
});

const textBlock = z.object({
  id: blockId,
  type: z.literal("text"),
  title: nullableString(z.string().trim().max(200, "عنوان حداکثر ۲۰۰ کاراکتر است")),
  body: z.string().trim().min(1, "متن الزامی است").max(5000, "متن حداکثر ۵۰۰۰ کاراکتر است"),
});

const featureCardsBlock = z.object({
  id: blockId,
  type: z.literal("feature_cards"),
  title: nullableString(z.string().trim().max(200, "عنوان حداکثر ۲۰۰ کاراکتر است")),
  cards: z
    .array(
      z.object({
        icon: iconSchema,
        title: z.string().trim().min(1, "عنوان کارت الزامی است").max(120),
        description: z.string().trim().max(500, "توضیح حداکثر ۵۰۰ کاراکتر است").default(""),
      }),
    )
    .min(1, "حداقل یک کارت لازم است")
    .max(12, "حداکثر ۱۲ کارت مجاز است"),
});

const statsBlock = z.object({
  id: blockId,
  type: z.literal("stats"),
  title: nullableString(z.string().trim().max(200)),
  items: z
    .array(
      z.object({
        value: z.string().trim().min(1, "مقدار الزامی است").max(40),
        label: z.string().trim().min(1, "برچسب الزامی است").max(120),
      }),
    )
    .min(1, "حداقل یک مورد لازم است")
    .max(8, "حداکثر ۸ مورد مجاز است"),
});

const imageBlock = z.object({
  id: blockId,
  type: z.literal("image"),
  url: imageUrlSchema("آدرس تصویر الزامی است"),
  // Empty alt is legitimate: a purely decorative image should be skipped by a
  // screen reader rather than described.
  alt: z.string().trim().max(200).default(""),
  caption: nullableString(z.string().trim().max(300)),
});

const ctaBlock = z.object({
  id: blockId,
  type: z.literal("cta"),
  title: z.string().trim().min(1, "عنوان الزامی است").max(200),
  description: nullableString(z.string().trim().max(600)),
  buttonLabel: z.string().trim().min(1, "متن دکمه الزامی است").max(80),
  // Internal path or absolute URL. `javascript:` and friends are excluded by
  // requiring one of the two safe shapes rather than by blacklisting schemes.
  buttonUrl: z
    .string()
    .trim()
    .min(1, "مقصد دکمه الزامی است")
    .max(500)
    .refine(
      (value) => value.startsWith("/") || /^https?:\/\//i.test(value),
      "مقصد دکمه باید یک نشانی معتبر یا مسیر داخلی باشد",
    ),
});

export const contentBlockSchema = z.discriminatedUnion("type", [
  headingBlock,
  textBlock,
  featureCardsBlock,
  statsBlock,
  imageBlock,
  ctaBlock,
]);

export const contentPageParamsSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(1)
    // Slugs are fixed routes in the app, not free-form: a page the router has
    // no route for would be editable in the admin and unreachable on the site.
    .refine((value) => ["about", "contact", "rules"].includes(value), "صفحه موردنظر یافت نشد"),
});

export const contentPageUpdateSchema = z
  .object({
    title: z.string().trim().min(1, "عنوان صفحه الزامی است").max(200).optional(),
    metaTitle: nullableString(z.string().trim().max(200)),
    metaDescription: nullableString(z.string().trim().max(500)),
    blocks: z.array(contentBlockSchema).max(40, "حداکثر ۴۰ بلوک مجاز است").optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "حداقل یک فیلد برای ویرایش الزامی است",
  });

export type ContentBlock = z.infer<typeof contentBlockSchema>;
export type ContentPageParams = z.infer<typeof contentPageParamsSchema>;
export type ContentPageUpdateBody = z.infer<typeof contentPageUpdateSchema>;
