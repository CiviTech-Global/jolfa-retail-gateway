/**
 * Every event that can send an SMS, and the variables its text may use.
 *
 * This list is the contract between the code that fires a notification and the
 * admin who writes its wording. It lives in code rather than the database on
 * purpose: a row for an event no code path fires would be an editable template
 * that never sends, and a placeholder the sender does not supply would reach a
 * customer as a literal `{{trackingNumber}}`.
 *
 * Adding an event means adding it here AND calling `notify` from the matching
 * code path. Nothing else is needed — the row is created on the next boot.
 */

export const SMS_EVENTS = [
  "password_reset_otp",
  "password_changed_by_admin",
  "welcome",
  "order_placed",
  "order_paid",
  "order_shipped",
  "order_delivered",
  "order_cancelled",
] as const;

export type SmsEvent = (typeof SMS_EVENTS)[number];

export interface SmsEventDefinition {
  event: SmsEvent;
  /** Shown as the row's name in the admin panel. */
  label: string;
  /** When this fires, in the admin's terms. */
  description: string;
  /** Placeholders the sender supplies, without braces. */
  variables: string[];
  /**
   * VERIFY uses a template registered in SMS.ir's panel; BULK sends `body` as
   * free text from the shop's own line.
   *
   * One-time codes are VERIFY and not negotiable: a service line arrives in
   * seconds and reaches customers who have blocked advertising SMS, and a login
   * code that silently fails for those customers locks them out of the shop.
   */
  channel: "VERIFY" | "BULK";
  /** Default wording for BULK events. The admin may rewrite it freely. */
  defaultBody?: string;
  /**
   * For VERIFY: the parameter names the SMS.ir template expects, mapped from
   * our variables. Their panel defines these; a mismatch sends the template
   * with the placeholder unreplaced.
   */
  parameterMap?: Record<string, string>;
}

export const SMS_EVENT_DEFINITIONS: SmsEventDefinition[] = [
  {
    event: "password_reset_otp",
    label: "کد بازیابی رمز عبور",
    description: "هنگام درخواست بازیابی رمز عبور برای کاربر ارسال می‌شود.",
    variables: ["code"],
    channel: "VERIFY",
    // Mapped to the `Code` parameter of the template registered at SMS.ir.
    parameterMap: { Code: "code" },
  },
  {
    event: "password_changed_by_admin",
    label: "تغییر رمز عبور توسط مدیر",
    description: "پس از آنکه مدیر رمز عبور یک کاربر را تغییر دهد ارسال می‌شود.",
    variables: ["siteName"],
    channel: "BULK",
    defaultBody:
      "رمز عبور حساب شما در {{siteName}} توسط مدیر تغییر کرد. اگر این تغییر را انتظار نداشتید با پشتیبانی تماس بگیرید.",
  },
  {
    event: "welcome",
    label: "خوش‌آمدگویی",
    description: "پس از ثبت‌نام کاربر جدید ارسال می‌شود.",
    variables: ["siteName"],
    channel: "BULK",
    defaultBody: "به {{siteName}} خوش آمدید. از اینکه ما را انتخاب کردید سپاسگزاریم.",
  },
  {
    event: "order_placed",
    label: "ثبت سفارش",
    description: "به‌محض ثبت سفارش توسط مشتری ارسال می‌شود.",
    variables: ["orderNumber", "amount", "siteName"],
    channel: "BULK",
    defaultBody:
      "سفارش {{orderNumber}} در {{siteName}} ثبت شد. مبلغ: {{amount}} تومان. پس از پرداخت، سفارش پردازش می‌شود.",
  },
  {
    event: "order_paid",
    label: "پرداخت موفق",
    description: "پس از تایید پرداخت سفارش ارسال می‌شود.",
    variables: ["orderNumber", "amount", "siteName"],
    channel: "BULK",
    defaultBody:
      "پرداخت سفارش {{orderNumber}} به مبلغ {{amount}} تومان تایید شد. سفارش شما در حال پردازش است.",
  },
  {
    event: "order_shipped",
    label: "ارسال سفارش",
    description: "هنگام تغییر وضعیت سفارش به «ارسال شده» ارسال می‌شود.",
    variables: ["orderNumber", "trackingNumber", "siteName"],
    channel: "BULK",
    defaultBody: "سفارش {{orderNumber}} ارسال شد. کد رهگیری: {{trackingNumber}}",
  },
  {
    event: "order_delivered",
    label: "تحویل سفارش",
    description: "هنگام تغییر وضعیت سفارش به «تحویل شده» ارسال می‌شود.",
    variables: ["orderNumber", "siteName"],
    channel: "BULK",
    defaultBody:
      "سفارش {{orderNumber}} تحویل داده شد. از خرید شما در {{siteName}} سپاسگزاریم.",
  },
  {
    event: "order_cancelled",
    label: "لغو سفارش",
    description: "هنگام لغو سفارش ارسال می‌شود.",
    variables: ["orderNumber", "siteName"],
    channel: "BULK",
    defaultBody: "سفارش {{orderNumber}} لغو شد. در صورت پرداخت، مبلغ طی ۷۲ ساعت بازگردانده می‌شود.",
  },
];

const BY_EVENT = new Map(SMS_EVENT_DEFINITIONS.map((d) => [d.event, d]));

export function smsEventDefinition(event: SmsEvent): SmsEventDefinition {
  const definition = BY_EVENT.get(event);
  if (!definition) {
    // Unreachable through the type, but a hand-written DB row could get here.
    throw new Error(`Unknown SMS event: ${event}`);
  }
  return definition;
}

/**
 * Substitutes `{{name}}` placeholders.
 *
 * An unknown placeholder is left as-is rather than blanked, so a typo in the
 * admin's text shows up as `{{ordrNumber}}` in the test send instead of a gap
 * that reads like a missing order number.
 */
export function renderTemplate(body: string, variables: Record<string, string>): string {
  return body.replace(/\{\{\s*(\w+)\s*\}\}/g, (whole, name: string) =>
    Object.prototype.hasOwnProperty.call(variables, name) ? variables[name] : whole,
  );
}

/** Placeholders in `body` that the event does not supply. */
export function unknownPlaceholders(body: string, allowed: string[]): string[] {
  const used = [...body.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((match) => match[1]);
  return [...new Set(used.filter((name) => !allowed.includes(name)))];
}
