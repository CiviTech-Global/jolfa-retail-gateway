import type { Prisma } from "@prisma/client";
import { prisma } from "../prisma.js";
import { env } from "../../config/env.js";
import { logger } from "../logger.js";
import {
  SmsIrError,
  describeSmsIrStatus,
  isSmsIrConfigured,
  normalizeMobile,
  sendBulk,
  sendVerify,
  smsIrLineNumber,
} from "./smsir.client.js";
import {
  SMS_EVENT_DEFINITIONS,
  renderTemplate,
  smsEventDefinition,
  type SmsEvent,
} from "./sms-events.js";

/**
 * Sends the SMS for one event, if the shop owner has that event switched on.
 *
 * Never throws. A notification is a side effect of something that already
 * succeeded — an order was placed, a password was reset — and failing the
 * surrounding request because the SMS provider is out of credit would turn a
 * completed purchase into an error page. Every outcome is written to
 * `sms_notifications` instead, which is what the admin's SMS log reads.
 */

export type NotifyOutcome =
  | "sent"
  | "disabled"
  | "not_configured"
  | "no_line"
  | "invalid_number"
  | "failed";

export interface NotifyResult {
  outcome: NotifyOutcome;
  /** Set when the message was actually handed to SMS.ir. */
  messageId?: number | null;
  reason?: string;
  /**
   * The rendered text, returned ONLY when nothing was sent because no provider
   * is configured. It is what makes local development possible without a key,
   * and the caller decides whether exposing it is acceptable.
   */
  previewText?: string;
}

export interface NotifyInput {
  event: SmsEvent;
  phone: string;
  userId?: string;
  /** Values for the event's `{{placeholders}}`. */
  variables?: Record<string, string>;
}

/**
 * Creates any missing template row from the catalogue in `sms-events.ts`.
 *
 * Create-only, like the settings and content pages: a deploy must never
 * overwrite wording the shop owner has edited, nor silently switch an event
 * back on after they turned it off.
 */
export async function ensureDefaultSmsTemplates(): Promise<void> {
  for (const definition of SMS_EVENT_DEFINITIONS) {
    const existing = await prisma.smsTemplate.findUnique({
      where: { event: definition.event },
      select: { id: true },
    });
    if (existing) continue;

    await prisma.smsTemplate.create({
      data: {
        event: definition.event,
        channel: definition.channel,
        body: definition.channel === "BULK" ? (definition.defaultBody ?? null) : null,
        // VERIFY events need a template id from SMS.ir's panel. Seeded from the
        // environment when it is known, so a fresh install is one env var away
        // from working rather than requiring a database edit.
        providerTemplateId:
          definition.channel === "VERIFY" ? smsIrOtpTemplateId() : null,
        // An event with nothing to send starts switched off, so the admin is
        // never told a notification is active when it cannot possibly deliver.
        enabled: definition.channel === "BULK" || smsIrOtpTemplateId() !== null,
      },
    });
  }
}

/** Seed value for VERIFY events; the admin panel owns it after first boot. */
function smsIrOtpTemplateId(): number | null {
  return env.SMS_IR_OTP_TEMPLATE_ID ?? null;
}

async function record(
  input: NotifyInput,
  message: string,
  status: "SENT" | "FAILED" | "PENDING",
  providerResponse: Prisma.InputJsonValue,
): Promise<void> {
  await prisma.smsNotification.create({
    data: {
      userId: input.userId ?? null,
      phone: input.phone,
      message,
      template: input.event,
      status,
      sentAt: status === "SENT" ? new Date() : null,
      providerResponse,
    },
  });
}

export async function notify(input: NotifyInput): Promise<NotifyResult> {
  const definition = smsEventDefinition(input.event);
  const variables = input.variables ?? {};

  const template = await prisma.smsTemplate.findUnique({ where: { event: input.event } });

  // No row yet (a brand-new event on a server that has not rebooted) is treated
  // as the catalogue default rather than as "off", so a newly added
  // notification is not silently dropped for one deploy.
  const enabled = template?.enabled ?? true;
  const channel = (template?.channel ?? definition.channel) as "VERIFY" | "BULK";
  const body = template?.body ?? definition.defaultBody ?? "";
  const providerTemplateId = template?.providerTemplateId ?? smsIrOtpTemplateId();

  /**
   * Two renderings of the same message, and they must not be confused: one is
   * sent to the customer with the real values, the other is what the delivery
   * log keeps. A secret variable — see `secretVariables` in the catalogue — is
   * masked in the second one only.
   */
  const secrets = new Set(definition.secretVariables ?? []);
  const maskVariables = (values: Record<string, string>): Record<string, string> =>
    Object.fromEntries(
      Object.entries(values).map(([key, value]) => [
        key,
        secrets.has(key) ? "******" : value,
      ]),
    );

  const describe = (values: Record<string, string>): string =>
    channel === "BULK"
      ? renderTemplate(body, values)
      : // VERIFY text lives in SMS.ir's panel; this only describes the call.
        `[قالب ${providerTemplateId ?? "?"}] ${Object.entries(values)
          .map(([key, value]) => `${key}=${value}`)
          .join(", ")}`;

  const messageText = describe(variables);
  const renderedText = describe(maskVariables(variables));

  if (!enabled) {
    // Not recorded in sms_notifications: the shop owner switched this off, so
    // it is a configuration choice, not a delivery event, and logging it as a
    // notification would make the log unreadable.
    return { outcome: "disabled" };
  }

  if (normalizeMobile(input.phone) === null) {
    await record(input, renderedText, "FAILED", { reason: "invalid mobile number" });
    return { outcome: "invalid_number", reason: "شماره موبایل نادرست است" };
  }

  if (!isSmsIrConfigured()) {
    logger.info(
      { event: input.event, phone: input.phone },
      "sms not configured — message logged instead of sent",
    );
    await record(input, renderedText, "PENDING", {
      provider: "none",
      note: "no SMS_IR_API_KEY configured; not sent",
    });
    return { outcome: "not_configured", previewText: renderedText };
  }

  if (channel === "BULK" && !smsIrLineNumber()) {
    // Free text needs the shop's own line. Recorded rather than thrown so the
    // admin can see in the log exactly which notifications were lost to a
    // missing setting, instead of wondering why customers heard nothing.
    await record(input, renderedText, "FAILED", {
      reason: "SMS_SENDER_NUMBER not configured; free-text SMS needs a line number",
    });
    return {
      outcome: "no_line",
      reason: "شماره خط ارسال پیامک تنظیم نشده است",
    };
  }

  if (channel === "VERIFY" && !providerTemplateId) {
    await record(input, renderedText, "FAILED", {
      reason: "no SMS.ir template id configured for this event",
    });
    return { outcome: "failed", reason: "شناسه قالب پیامک تنظیم نشده است" };
  }

  try {
    if (channel === "VERIFY") {
      const parameters = Object.entries(definition.parameterMap ?? {}).map(
        ([parameterName, variableName]) => ({
          name: parameterName,
          value: variables[variableName] ?? "",
        }),
      );

      const result = await sendVerify({
        mobile: input.phone,
        templateId: providerTemplateId!,
        parameters,
      });

      await record(input, renderedText, "SENT", {
        provider: "sms.ir",
        channel,
        templateId: providerTemplateId,
        messageId: result.messageId,
        cost: result.cost,
      });
      return { outcome: "sent", messageId: result.messageId };
    }

    const result = await sendBulk({ mobiles: [input.phone], messageText });
    const messageId = result.messageIds[0] ?? null;

    // Per the docs, 0 means the recipient is blacklisted and null means the
    // number was rejected or the text too long. The pack succeeds either way,
    // so without this check a message nobody received is recorded as sent.
    if (messageId === null || messageId === 0) {
      await record(input, renderedText, "FAILED", {
        provider: "sms.ir",
        channel,
        packId: result.packId,
        reason:
          messageId === 0
            ? "شماره در لیست سیاه سامانه پیامک است"
            : "شماره نادرست یا متن بیش از حد طولانی است",
      });
      return {
        outcome: "failed",
        reason:
          messageId === 0
            ? "شماره در لیست سیاه سامانه پیامک است"
            : "شماره نادرست یا متن بیش از حد طولانی است",
      };
    }

    await record(input, renderedText, "SENT", {
      provider: "sms.ir",
      channel,
      packId: result.packId,
      messageId,
      cost: result.cost,
    });
    return { outcome: "sent", messageId };
  } catch (error) {
    const reason =
      error instanceof SmsIrError
        ? error.message
        : error instanceof Error
          ? error.message
          : String(error);

    logger.error({ err: error, event: input.event }, "sms notification failed");

    await record(input, renderedText, "FAILED", {
      provider: "sms.ir",
      channel,
      reason,
      status: error instanceof SmsIrError ? error.status : null,
      statusText:
        error instanceof SmsIrError ? describeSmsIrStatus(error.status) : undefined,
    });

    return { outcome: "failed", reason };
  }
}
