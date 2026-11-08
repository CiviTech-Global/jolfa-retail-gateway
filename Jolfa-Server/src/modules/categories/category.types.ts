import { z } from "zod";
import {
  imageUrl as imageUrlSchema,
  nullableString,
  optionalString,
  requiredString,
  updateSchemaOf,
} from "../../shared/zod-helpers.js";

export const categoryListQuerySchema = z.object({
  tree: z
    .union([z.boolean(), z.string()])
    .transform((value) => {
      if (typeof value === "boolean") return value;
      return ["true", "1", "yes", "on"].includes(value.toLowerCase());
    })
    .optional(),
  parentId: z.guid().optional().or(z.literal("").transform(() => undefined)),
});

export const categoryCreateBodySchema = z.object({
  name: requiredString("نام دسته‌بندی", 100),
  slug: optionalString(
    z
      .string()
      .trim()
      .max(120, "اسلاگ حداکثر ۱۲۰ کاراکتر است")
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "اسلاگ فقط می‌تواند شامل حروف انگلیسی کوچک، عدد و خط تیره باشد"),
  ),
  description: nullableString(z.string().trim().max(1000, "توضیحات حداکثر ۱۰۰۰ کاراکتر است")),
  // Was `z.string().url()`, which rejected the server-relative paths the
  // upload endpoint returns.
  imageUrl: nullableString(imageUrlSchema()),
  parentId: nullableString(z.guid("دسته‌بندی والد معتبر نیست")),
  displayOrder: z.coerce
    .number({ error: "ترتیب نمایش باید عدد باشد" })
    .int("ترتیب نمایش باید عدد صحیح باشد")
    .default(0),
  isActive: z.boolean().default(true),
});

export const categoryUpdateBodySchema = updateSchemaOf(categoryCreateBodySchema);

export const categoryParamsSchema = z.object({
  slug: z.string().min(1),
});

export type CategoryListQuery = z.infer<typeof categoryListQuerySchema>;
export type CategoryCreateBody = z.infer<typeof categoryCreateBodySchema>;
export type CategoryUpdateBody = z.infer<typeof categoryUpdateBodySchema>;
export type CategoryParams = z.infer<typeof categoryParamsSchema>;
