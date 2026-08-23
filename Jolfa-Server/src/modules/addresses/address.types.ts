import { z } from "zod";

export const addressCreateSchema = z.object({
  title: z.string().trim().max(100).optional(),
  recipientName: z.string().trim().min(1, "نام گیرنده الزامی است").max(200),
  phone: z.string().trim().min(10, "شماره موبایل معتبر نیست").max(15),
  province: z.string().trim().min(1, "استان الزامی است").max(100),
  city: z.string().trim().min(1, "شهر الزامی است").max(100),
  district: z.string().trim().max(100).optional(),
  postalCode: z.string().trim().max(20).optional(),
  addressLine: z.string().trim().min(1, "آدرس الزامی است"),
  /** First address saved becomes the default regardless of this flag. */
  isDefault: z.boolean().optional(),
});

/** Every field optional, but an empty body is a no-op we reject up front. */
export const addressUpdateSchema = addressCreateSchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  { message: "حداقل یک فیلد برای ویرایش الزامی است" }
);

export const addressParamsSchema = z.object({
  id: z.string().uuid("شناسه آدرس معتبر نیست"),
});

export type AddressCreateBody = z.infer<typeof addressCreateSchema>;
export type AddressUpdateBody = z.infer<typeof addressUpdateSchema>;
export type AddressParams = z.infer<typeof addressParamsSchema>;
