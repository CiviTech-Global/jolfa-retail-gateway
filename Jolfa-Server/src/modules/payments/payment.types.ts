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

/**
 * What Zibal appends to our callbackUrl. It arrives as a GET query string from
 * the customer's browser, so every field is untrusted input: `success` and
 * `status` are read for logging and for choosing the message shown, never to
 * decide whether the order is paid. That decision comes from calling verify.
 *
 * Coerced rather than parsed strictly — a gateway that one day sends
 * `success=true` instead of `success=1` should not 500 the customer's return
 * journey.
 */
export const zibalCallbackQuerySchema = z.object({
  trackId: z.string().min(1),
  success: z.string().optional(),
  status: z.string().optional(),
  orderId: z.string().optional(),
});

export type PaymentRequestBody = z.infer<typeof paymentRequestBodySchema>;
export type PaymentVerifyBody = z.infer<typeof paymentVerifyBodySchema>;
export type PaymentParams = z.infer<typeof paymentParamsSchema>;
export type ZibalCallbackQuery = z.infer<typeof zibalCallbackQuerySchema>;
