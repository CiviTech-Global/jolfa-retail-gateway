import { prisma } from "../../shared/prisma.js";
import { AppError, NotFoundError } from "../../shared/app-error.js";
import { logAudit, buildChangeMetadata } from "../../shared/audit/audit.service.js";
import {
  SMS_EVENT_DEFINITIONS,
  renderTemplate,
  smsEventDefinition,
  unknownPlaceholders,
  type SmsEvent,
} from "../../shared/sms/sms-events.js";
import { notify } from "../../shared/sms/notification.service.js";
import {
  describeDeliveryState,
  getCredit,
  getLines,
  isSmsIrConfigured,
  smsIrLineNumber,
} from "../../shared/sms/smsir.client.js";
import type { SmsTemplateUpdateBody, SmsTestSendBody } from "./sms.types.js";

export interface SmsTemplateDto {
  event: SmsEvent;
  label: string;
  description: string;
  channel: "VERIFY" | "BULK";
  enabled: boolean;
  body: string | null;
  providerTemplateId: number | null;
  variables: string[];
  /** A rendered example, so the admin sees the real wording before saving. */
  preview: string | null;
  /**
   * Why this template cannot currently send, if it cannot. Surfaced so the
   * admin never sees an event marked "on" that silently does nothing.
   */
  blockedReason: string | null;
}

/** Stand-in values for the preview. Deliberately recognisable as examples. */
const SAMPLE_VARIABLES: Record<string, string> = {
  code: "۱۲۳۴۵۶",
  orderNumber: "ORD-1024",
  amount: "۶۳۵٬۰۰۰",
  trackingNumber: "۱۲۳۴۵۶۷۸۹",
  siteName: "ارس پرو",
};

function blockedReason(
  channel: "VERIFY" | "BULK",
  providerTemplateId: number | null,
  body: string | null,
): string | null {
  if (!isSmsIrConfigured()) {
    return "کلید وب‌سرویس پیامک (SMS_IR_API_KEY) تنظیم نشده است.";
  }
  if (channel === "VERIFY" && !providerTemplateId) {
    return "شناسه قالب پیامک از پنل SMS.ir وارد نشده است.";
  }
  if (channel === "BULK" && !smsIrLineNumber()) {
    return "شماره خط ارسال (SMS_SENDER_NUMBER) تنظیم نشده است؛ ارسال متن آزاد بدون خط اختصاصی ممکن نیست.";
  }
  if (channel === "BULK" && !body?.trim()) {
    return "متن پیامک خالی است.";
  }
  return null;
}

export async function listSmsTemplates(): Promise<{ templates: SmsTemplateDto[] }> {
  const rows = await prisma.smsTemplate.findMany();
  const byEvent = new Map(rows.map((row) => [row.event, row]));

  // Driven by the code catalogue, not the table: an event the code never fires
  // must not appear as something the admin can configure, and a newly added
  // event shows up before its row exists.
  const templates = SMS_EVENT_DEFINITIONS.map((definition) => {
    const row = byEvent.get(definition.event);
    const channel = (row?.channel ?? definition.channel) as "VERIFY" | "BULK";
    const body = row?.body ?? definition.defaultBody ?? null;
    const providerTemplateId = row?.providerTemplateId ?? null;

    return {
      event: definition.event,
      label: definition.label,
      description: definition.description,
      channel,
      enabled: row?.enabled ?? true,
      body: channel === "BULK" ? body : null,
      providerTemplateId,
      variables: definition.variables,
      preview: channel === "BULK" && body ? renderTemplate(body, SAMPLE_VARIABLES) : null,
      blockedReason: blockedReason(channel, providerTemplateId, body),
    };
  });

  return { templates };
}

export async function updateSmsTemplate(
  event: SmsEvent,
  data: SmsTemplateUpdateBody,
  actorId: string,
): Promise<{ template: SmsTemplateDto }> {
  const definition = smsEventDefinition(event);
  const existing = await prisma.smsTemplate.findUnique({ where: { event } });
  if (!existing) {
    throw new NotFoundError("SMS template");
  }

  const channel = existing.channel as "VERIFY" | "BULK";

  if (data.body !== undefined) {
    if (channel === "VERIFY") {
      throw new AppError(
        "متن این پیامک در پنل SMS.ir تعریف می‌شود و از اینجا قابل تغییر نیست.",
        400,
        "SMS_BODY_NOT_EDITABLE",
      );
    }

    // A placeholder the sender does not supply would reach the customer as the
    // literal text `{{ordrNumber}}`, so it is refused at save time rather than
    // discovered in a delivered message.
    const unknown = unknownPlaceholders(data.body, definition.variables);
    if (unknown.length > 0) {
      throw new AppError(
        `این متغیرها برای این رویداد وجود ندارند: ${unknown.map((name) => `{{${name}}}`).join("، ")}`,
        400,
        "SMS_UNKNOWN_PLACEHOLDER",
      );
    }

    if (data.body.trim() === "") {
      throw new AppError("متن پیامک نمی‌تواند خالی باشد", 400, "SMS_EMPTY_BODY");
    }
  }

  const updated = await prisma.smsTemplate.update({
    where: { event },
    data: {
      ...(data.enabled !== undefined ? { enabled: data.enabled } : {}),
      ...(data.body !== undefined ? { body: data.body } : {}),
      ...(data.providerTemplateId !== undefined
        ? { providerTemplateId: data.providerTemplateId }
        : {}),
    },
  });

  await logAudit({
    userId: actorId,
    action: "UPDATE",
    entityType: "Setting",
    entityId: updated.id,
    metadata: buildChangeMetadata(
      { event, enabled: existing.enabled, body: existing.body },
      { event, enabled: updated.enabled, body: updated.body },
    ),
  });

  const { templates } = await listSmsTemplates();
  return { template: templates.find((t) => t.event === event)! };
}

/**
 * Sends one real message, so the admin can confirm the wording and that the
 * account actually delivers.
 *
 * Goes through the same `notify` path as production rather than a shortcut, so
 * a test that succeeds proves the real flow works — including the template id,
 * the line number and the credit.
 */
export async function sendTestSms(
  data: SmsTestSendBody,
  actorId: string,
): Promise<{ outcome: string; reason?: string; messageId?: number | null }> {
  const result = await notify({
    event: data.event,
    phone: data.phone,
    variables: SAMPLE_VARIABLES,
  });

  await logAudit({
    userId: actorId,
    action: "CREATE",
    entityType: "Setting",
    entityId: actorId,
    metadata: { smsTest: true, event: data.event, outcome: result.outcome },
  });

  return {
    outcome: result.outcome,
    reason: result.reason,
    messageId: result.messageId ?? null,
  };
}

export interface SmsAccountStatus {
  configured: boolean;
  lineNumber: string | null;
  credit: number | null;
  lines: number[] | null;
  error: string | null;
}

/**
 * Account health for the admin panel: credit, and which lines exist.
 *
 * Both are read-only calls that send nothing and cost nothing. `lines` is the
 * useful one — free-text notifications need a line number, and this is how the
 * admin finds out which numbers the account actually has.
 */
export async function getSmsAccountStatus(): Promise<SmsAccountStatus> {
  if (!isSmsIrConfigured()) {
    return {
      configured: false,
      lineNumber: smsIrLineNumber(),
      credit: null,
      lines: null,
      error: "کلید وب‌سرویس پیامک تنظیم نشده است",
    };
  }

  try {
    const [credit, lines] = await Promise.all([getCredit(), getLines()]);
    return {
      configured: true,
      lineNumber: smsIrLineNumber(),
      credit,
      lines,
      error: null,
    };
  } catch (error) {
    // Reported rather than thrown: the panel should still render, showing why
    // the figures are missing.
    return {
      configured: true,
      lineNumber: smsIrLineNumber(),
      credit: null,
      lines: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export interface SmsLogRow {
  id: string;
  phone: string;
  message: string;
  event: string | null;
  status: string;
  sentAt: Date | null;
  createdAt: Date;
  reason: string | null;
}

/** The delivery log, newest first. */
export async function listSmsLog(
  page: number,
  limit: number,
  event?: string,
  status?: string,
): Promise<{ rows: SmsLogRow[]; meta: { page: number; limit: number; total: number; totalPages: number } }> {
  const where = {
    ...(event ? { template: event } : {}),
    ...(status ? { status: status as "PENDING" | "SENT" | "FAILED" } : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.smsNotification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.smsNotification.count({ where }),
  ]);

  return {
    rows: rows.map((row) => {
      const response = (row.providerResponse ?? {}) as Record<string, unknown>;
      const reason =
        typeof response.reason === "string"
          ? response.reason
          : typeof response.statusText === "string"
            ? response.statusText
            : typeof response.note === "string"
              ? response.note
              : null;

      return {
        id: row.id,
        phone: row.phone,
        message: row.message,
        event: row.template,
        status: row.status,
        sentAt: row.sentAt,
        createdAt: row.createdAt,
        reason,
      };
    }),
    meta: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
  };
}

export { describeDeliveryState };
