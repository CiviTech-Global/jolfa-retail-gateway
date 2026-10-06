import { z } from "zod";
import { SMS_EVENTS } from "../../shared/sms/sms-events.js";

export const smsTemplateParamsSchema = z.object({
  event: z.enum(SMS_EVENTS, {
    errorMap: () => ({ message: "رویداد پیامک معتبر نیست" }),
  }),
});

export const smsTemplateUpdateSchema = z
  .object({
    enabled: z.boolean().optional(),
    /**
     * Free text for BULK events. Capped at 400 characters: SMS.ir bills per
     * 70-character part for Persian text, so a body beyond this quietly costs
     * six messages per notification.
     */
    body: z.string().trim().max(400, "متن پیامک حداکثر ۴۰۰ کاراکتر است").optional(),
    /** The template id from SMS.ir's panel, for VERIFY events. */
    providerTemplateId: z.coerce
      .number({ invalid_type_error: "شناسه قالب باید عدد باشد" })
      .int("شناسه قالب باید عدد صحیح باشد")
      .positive("شناسه قالب باید بزرگتر از صفر باشد")
      .nullable()
      .optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "حداقل یک فیلد برای ویرایش الزامی است",
  });

export const smsTestSendSchema = z.object({
  event: z.enum(SMS_EVENTS, {
    errorMap: () => ({ message: "رویداد پیامک معتبر نیست" }),
  }),
  /**
   * Where to send the test.
   *
   * Required rather than defaulting to the admin's own number: a test send
   * costs real credit and reaches a real handset, so the person triggering it
   * has to state the destination deliberately.
   */
  phone: z
    .string()
    .trim()
    .min(1, "شماره موبایل الزامی است")
    .max(20, "شماره موبایل نامعتبر است"),
});

export type SmsTemplateParams = z.infer<typeof smsTemplateParamsSchema>;
export type SmsTemplateUpdateBody = z.infer<typeof smsTemplateUpdateSchema>;
export type SmsTestSendBody = z.infer<typeof smsTestSendSchema>;
