import { z } from "zod";

export const paymentRequestBodySchema = z.object({
  orderId: z.string().uuid(),
});

export const paymentVerifyBodySchema = z.object({
  authority: z.string().min(1),
  status: z.enum(["OK", "NOK"]).optional(),
});

export const paymentParamsSchema = z.object({
  authority: z.string().min(1),
});

export type PaymentRequestBody = z.infer<typeof paymentRequestBodySchema>;
export type PaymentVerifyBody = z.infer<typeof paymentVerifyBodySchema>;
export type PaymentParams = z.infer<typeof paymentParamsSchema>;
