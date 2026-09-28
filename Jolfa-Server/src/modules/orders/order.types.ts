import { z } from "zod";
import { postalCodeSchema } from "../../shared/zod-helpers.js";

export const shippingAddressSchema = z.object({
  title: z.string().max(100).optional(),
  recipientName: z.string().min(1, "نام گیرنده الزامی است").max(200),
  phone: z.string().min(10, "شماره موبایل معتبر نیست").max(15),
  province: z.string().min(1, "استان الزامی است").max(100),
  city: z.string().min(1, "شهر الزامی است").max(100),
  district: z.string().max(100).optional(),
  // Same rule as the address book, so a saved address that predates it is
  // caught when order.service re-validates it rather than shipped half-filled.
  postalCode: postalCodeSchema(),
  addressLine: z.string().min(1, "آدرس الزامی است"),
});

export const orderItemSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().positive("تعداد باید بیشتر از صفر باشد"),
});

export const orderCreateBodySchema = z
  .object({
    items: z.array(orderItemSchema).min(1, "حداقل یک کالا الزامی است"),
    /** A saved address from the user's book; snapshotted onto the order. */
    shippingAddressId: z.string().uuid("آدرس انتخاب‌شده معتبر نیست").optional(),
    /** A one-off address typed at checkout. */
    shippingAddress: shippingAddressSchema.optional(),
    /** Also store the typed address in the book for next time. */
    saveAddress: z.boolean().optional(),
    shippingMethod: z.enum(["POST", "COURIER"]).default("POST"),
    customerNote: z.string().max(1000).optional(),
  })
  .refine((data) => Boolean(data.shippingAddressId) !== Boolean(data.shippingAddress), {
    path: ["shippingAddress"],
    message: "یک آدرس انتخاب کنید یا آدرس جدیدی وارد کنید",
  });

export const orderListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  status: z.enum(["PENDING", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"]).optional(),
  paymentStatus: z.enum(["PENDING", "COMPLETED", "FAILED", "REFUNDED"]).optional(),
  /** Order number, tracking number, or the customer's name or mobile. */
  q: z.string().trim().max(120).optional().or(z.literal("").transform(() => undefined)),
  /** Inclusive ISO dates. `to` is widened to the end of that day by the service. */
  from: z.string().datetime().optional().or(z.string().date().optional()),
  to: z.string().datetime().optional().or(z.string().date().optional()),
  sort: z
    .enum(["createdAt:desc", "createdAt:asc", "total:desc", "total:asc"])
    .default("createdAt:desc"),
});

export const orderParamsSchema = z.object({
  id: z.string().uuid(),
});

export const orderStatusUpdateSchema = z.object({
  status: z.enum(["PENDING", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"]),
  note: z.string().max(1000).optional(),
});

export type OrderCreateBody = z.infer<typeof orderCreateBodySchema>;
export type OrderListQuery = z.infer<typeof orderListQuerySchema>;
export type OrderParams = z.infer<typeof orderParamsSchema>;
export type OrderStatusUpdateBody = z.infer<typeof orderStatusUpdateSchema>;
