import { z } from "zod";

export const shippingAddressSchema = z.object({
  title: z.string().max(100).optional(),
  recipientName: z.string().min(1, "نام گیرنده الزامی است").max(200),
  phone: z.string().min(10, "شماره موبایل معتبر نیست").max(15),
  province: z.string().min(1, "استان الزامی است").max(100),
  city: z.string().min(1, "شهر الزامی است").max(100),
  district: z.string().max(100).optional(),
  postalCode: z.string().max(20).optional(),
  addressLine: z.string().min(1, "آدرس الزامی است"),
});

export const orderItemSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().positive("تعداد باید بیشتر از صفر باشد"),
});

export const orderCreateBodySchema = z.object({
  items: z.array(orderItemSchema).min(1, "حداقل یک کالا الزامی است"),
  shippingAddress: shippingAddressSchema,
  shippingMethod: z.enum(["POST", "COURIER"]).default("POST"),
  customerNote: z.string().max(1000).optional(),
});

export const orderListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  status: z.enum(["PENDING", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"]).optional(),
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
