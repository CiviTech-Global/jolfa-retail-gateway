import { prisma } from "../prisma.js";
import { logger } from "../logger.js";
import { notify } from "./notification.service.js";
import type { SmsEvent } from "./sms-events.js";
import { resolveSiteName as siteName } from "./site-name.js";

/**
 * Order notifications, resolved from the order itself.
 *
 * Kept out of `order.service.ts` so that adding a notification does not mean
 * editing the order flow, and so the lookup of the recipient — which is not
 * obvious — lives in one place.
 */

/** Which order status sends which notification. Omitted statuses send nothing. */
const STATUS_EVENTS: Partial<Record<string, SmsEvent>> = {
  SHIPPED: "order_shipped",
  DELIVERED: "order_delivered",
  CANCELLED: "order_cancelled",
  // PROCESSING is deliberately absent: it is set the moment payment succeeds,
  // and `order_paid` already covers that. Two texts for one event reads as a
  // bug to the customer and bills the shop twice.
};

function formatToman(amount: number): string {
  return new Intl.NumberFormat("fa-IR").format(amount);
}

/**
 * The number to text for an order.
 *
 * A guest checkout has no user, so the shipping address is the fallback — and
 * it is the better number anyway: the recipient is whoever is expecting the
 * parcel, which is not always the account holder.
 */
async function recipientFor(orderId: string) {
  return prisma.order.findUnique({
    where: { id: orderId },
    select: {
      orderNumber: true,
      finalAmount: true,
      trackingNumber: true,
      userId: true,
      user: { select: { phone: true } },
      shippingAddress: { select: { phone: true, recipientName: true } },
    },
  });
}



/** Fires the notification for a status change, if one is mapped to it. */
export async function notifyOrderEvent(orderId: string, status: string): Promise<void> {
  const event = STATUS_EVENTS[status];
  if (!event) return;

  const order = await recipientFor(orderId);
  if (!order) return;

  const phone = order.shippingAddress?.phone ?? order.user?.phone;
  if (!phone) {
    logger.warn({ orderId, status }, "order notification skipped: no phone on the order");
    return;
  }

  await notify({
    event,
    phone,
    userId: order.userId ?? undefined,
    variables: {
      orderNumber: order.orderNumber,
      amount: formatToman(order.finalAmount),
      // An empty tracking number would render as a bare "کد رهگیری:" line, so
      // it falls back to words the customer can act on.
      trackingNumber: order.trackingNumber?.trim() || "ثبت نشده",
      siteName: await siteName(),
    },
  });
}

/** Sent when the order is first created, before any payment. */
export async function notifyOrderPlaced(orderId: string): Promise<void> {
  const order = await recipientFor(orderId);
  if (!order) return;

  const phone = order.shippingAddress?.phone ?? order.user?.phone;
  if (!phone) return;

  await notify({
    event: "order_placed",
    phone,
    userId: order.userId ?? undefined,
    variables: {
      orderNumber: order.orderNumber,
      amount: formatToman(order.finalAmount),
      siteName: await siteName(),
    },
  });
}

/** Sent once the gateway confirms payment. */
export async function notifyOrderPaid(orderId: string): Promise<void> {
  const order = await recipientFor(orderId);
  if (!order) return;

  const phone = order.shippingAddress?.phone ?? order.user?.phone;
  if (!phone) return;

  await notify({
    event: "order_paid",
    phone,
    userId: order.userId ?? undefined,
    variables: {
      orderNumber: order.orderNumber,
      amount: formatToman(order.finalAmount),
      siteName: await siteName(),
    },
  });
}
