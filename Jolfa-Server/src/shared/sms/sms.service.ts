import { prisma } from "../prisma.js";
import { env } from "../../config/env.js";

/**
 * SMS delivery with a provider chosen from configuration.
 *
 * No provider key configured → the message is recorded and logged instead of
 * sent, so the OTP flow is fully testable locally. Configure
 * KAVENEGAR_API_KEY or SMS_IR_API_KEY in .env to send for real.
 */

export type SmsTemplate = "password-reset";

export interface SendSmsInput {
  phone: string;
  message: string;
  template?: SmsTemplate;
  userId?: string;
}

export interface SendSmsResult {
  delivered: boolean;
  provider: "kavenegar" | "sms.ir" | "log";
}

function activeProvider(): SendSmsResult["provider"] {
  if (env.KAVENEGAR_API_KEY) return "kavenegar";
  if (env.SMS_IR_API_KEY) return "sms.ir";
  return "log";
}

/** True when messages are only logged — surfaced so callers can warn. */
export function isSmsConfigured(): boolean {
  return activeProvider() !== "log";
}

async function sendViaKavenegar(input: SendSmsInput): Promise<unknown> {
  const url = new URL(
    `https://api.kavenegar.com/v1/${env.KAVENEGAR_API_KEY}/sms/send.json`,
  );
  url.searchParams.set("receptor", input.phone);
  url.searchParams.set("message", input.message);
  if (env.SMS_SENDER_NUMBER) {
    url.searchParams.set("sender", env.SMS_SENDER_NUMBER);
  }

  const response = await fetch(url, { method: "POST" });
  const payload: unknown = await response.json().catch(() => undefined);
  if (!response.ok) {
    throw new Error(`Kavenegar responded ${response.status}`);
  }
  return payload;
}

async function sendViaSmsIr(input: SendSmsInput): Promise<unknown> {
  const response = await fetch("https://api.sms.ir/v1/send/bulk", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": env.SMS_IR_API_KEY ?? "",
    },
    body: JSON.stringify({
      lineNumber: env.SMS_SENDER_NUMBER,
      messageText: input.message,
      mobiles: [input.phone],
    }),
  });
  const payload: unknown = await response.json().catch(() => undefined);
  if (!response.ok) {
    throw new Error(`SMS.ir responded ${response.status}`);
  }
  return payload;
}

/**
 * Records every message in `sms_notifications` regardless of provider, so
 * delivery is auditable. Never throws: a failed SMS must not fail the
 * surrounding request (the caller decides what the user sees).
 */
export async function sendSms(input: SendSmsInput): Promise<SendSmsResult> {
  const provider = activeProvider();

  const record = await prisma.smsNotification.create({
    data: {
      userId: input.userId ?? null,
      phone: input.phone,
      message: input.message,
      template: input.template ?? null,
      status: "PENDING",
    },
  });

  if (provider === "log") {
    // Deliberate: without a provider key this is the only way to complete a
    // reset in development. Never reached once a key is configured.
    console.info(
      `[sms:log] no SMS provider configured — message for ${input.phone}: ${input.message}`,
    );
    await prisma.smsNotification.update({
      where: { id: record.id },
      data: {
        status: "SENT",
        sentAt: new Date(),
        providerResponse: { provider: "log", note: "logged, not sent" },
      },
    });
    return { delivered: false, provider };
  }

  try {
    const providerResponse =
      provider === "kavenegar" ? await sendViaKavenegar(input) : await sendViaSmsIr(input);

    await prisma.smsNotification.update({
      where: { id: record.id },
      data: {
        status: "SENT",
        sentAt: new Date(),
        providerResponse: providerResponse as never,
      },
    });
    return { delivered: true, provider };
  } catch (error) {
    await prisma.smsNotification.update({
      where: { id: record.id },
      data: {
        status: "FAILED",
        providerResponse: { error: error instanceof Error ? error.message : String(error) },
      },
    });
    return { delivered: false, provider };
  }
}
