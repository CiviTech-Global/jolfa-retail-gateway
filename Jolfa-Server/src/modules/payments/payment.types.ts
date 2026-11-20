import { z } from "zod";

export const paymentRequestBodySchema = z.object({
  orderId: z.guid(),
  /** Defaults to the card gateway, which is what every client sent before TorobPay. */
  method: z.enum(["ZIBAL", "TOROBPAY"]).default("ZIBAL"),
});

/** The cart total the checkout is about to pay, in Toman. */
export const paymentMethodsQuerySchema = z.object({
  amount: z.coerce.number().int().nonnegative(),
});

/**
 * What TorobPay posts back to the return URL (form-urlencoded). Like Zibal's
 * callback it is a claim from the customer's browser: `state` and `amount`
 * are logged, never acted on. Only `transactionId` is used, to find the
 * payment, and TorobPay is then asked what really happened.
 */
export const torobPayReturnSchema = z.object({
  transactionId: z.string().min(1).max(100),
  state: z.string().optional(),
  amount: z.string().optional(),
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
export type PaymentMethodsQuery = z.infer<typeof paymentMethodsQuerySchema>;
export type TorobPayReturn = z.infer<typeof torobPayReturnSchema>;
