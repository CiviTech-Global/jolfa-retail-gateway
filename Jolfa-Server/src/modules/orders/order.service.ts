import { prisma } from "../../shared/prisma.js";
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from "../../shared/app-error.js";
import { logAudit, buildChangeMetadata } from "../../shared/audit/audit.service.js";
import type {
  OrderCreateBody,
  OrderListQuery,
  OrderStatusUpdateBody,
} from "./order.types.js";

export async function createOrder(userId: string, data: OrderCreateBody) {
  const productIds = data.items.map((item) => item.productId);

  const products = await prisma.product.findMany({
    where: { id: { in: productIds }, isActive: true },
    select: { id: true, title: true, price: true, stockQuantity: true, sku: true },
  });

  if (products.length !== data.items.length) {
    throw new BadRequestError("برخی از محصولات نامعتبر یا غیرفعال هستند");
  }

  const productMap = new Map(products.map((p) => [p.id, p]));
  let totalAmount = 0;

  for (const item of data.items) {
    const product = productMap.get(item.productId);
    if (!product) {
      throw new BadRequestError("محصول نامعتبر");
    }
    if (product.stockQuantity < item.quantity) {
      throw new ConflictError(`موجودی ${product.title} کافی نیست`);
    }
    totalAmount += product.price * item.quantity;
  }

  const shippingCost = data.shippingMethod === "COURIER" ? 150_000 : 80_000;
  const finalAmount = totalAmount + shippingCost;

  const orderNumber = generateOrderNumber();

  const order = await prisma.$transaction(async (tx) => {
    const address = await tx.address.create({
      data: {
        userId,
        ...data.shippingAddress,
        isDefault: false,
      },
    });

    const created = await tx.order.create({
      data: {
        userId,
        orderNumber,
        totalAmount,
        shippingCost,
        finalAmount,
        shippingAddressId: address.id,
        notes: data.customerNote,
        items: {
          create: data.items.map((item) => {
            const product = productMap.get(item.productId)!;
            return {
              productId: item.productId,
              quantity: item.quantity,
              unitPrice: product.price,
              totalPrice: product.price * item.quantity,
              productTitle: product.title,
              productSku: product.sku,
            };
          }),
        },
      },
      include: {
        items: true,
        shippingAddress: true,
      },
    });

    for (const item of data.items) {
      const product = productMap.get(item.productId)!;
      await tx.product.update({
        where: { id: item.productId },
        data: { stockQuantity: { decrement: item.quantity } },
      });
      if (product.stockQuantity < item.quantity) {
        throw new ConflictError(`موجودی ${product.title} در طول تراکنش به پایان رسید`);
      }
    }

    return created;
  });

  return { order };
}

export async function listUserOrders(userId: string, query: OrderListQuery) {
  const { page, limit, status } = query;
  const skip = (page - 1) * limit;

  const where = { userId, ...(status ? { status } : {}) };

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      include: {
        items: { include: { product: { select: { slug: true, images: { where: { isPrimary: true }, take: 1 } } } } },
        payment: { select: { status: true, gateway: true } },
      },
    }),
    prisma.order.count({ where }),
  ]);

  return {
    orders,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

export async function getOrderById(orderId: string, userId: string, userRole: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: { include: { product: { select: { slug: true } } } },
      shippingAddress: true,
      payment: true,
      user: { select: { id: true, firstName: true, lastName: true, phone: true, email: true } },
    },
  });

  if (!order) {
    throw new NotFoundError("Order");
  }

  if (order.userId !== userId && userRole !== "ADMIN") {
    throw new ForbiddenError("شما دسترسی به این سفارش ندارید");
  }

  return { order };
}

export async function listAdminOrders(query: OrderListQuery) {
  const { page, limit, status } = query;
  const skip = (page - 1) * limit;

  const where = status ? { status } : {};

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      include: {
        items: { select: { id: true, productTitle: true, quantity: true, unitPrice: true } },
        user: { select: { firstName: true, lastName: true, phone: true } },
        payment: { select: { status: true, gateway: true } },
      },
    }),
    prisma.order.count({ where }),
  ]);

  return {
    orders,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

export async function updateOrderStatus(
  orderId: string,
  data: OrderStatusUpdateBody,
  actorId?: string,
) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true },
  });
  if (!order) {
    throw new NotFoundError("Order");
  }

  const previousStatus = order.status;

  const updated = await prisma.order.update({
    where: { id: orderId },
    data: {
      status: data.status,
      notes: data.note ? `${order.notes ?? ""}\n[${new Date().toISOString()}] ${data.note}`.trim() : order.notes,
    },
    include: {
      items: { select: { productTitle: true, quantity: true } },
      user: { select: { phone: true } },
    },
  });

  await prisma.orderStatusHistory.create({
    data: {
      orderId,
      previousStatus,
      newStatus: data.status,
      changedById: actorId,
      note: data.note,
    },
  });

  if (actorId) {
    await logAudit({
      userId: actorId,
      action: "STATUS_CHANGE",
      entityType: "Order",
      entityId: orderId,
      metadata: {
        previousStatus,
        newStatus: data.status,
        note: data.note,
      },
    });
  }

  return { order: updated };
}

export async function getAdminOrderDetail(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: { include: { product: { select: { slug: true, images: { where: { isPrimary: true }, take: 1 } } } } },
      shippingAddress: true,
      payment: true,
      transactions: { orderBy: { createdAt: "desc" } },
      statusHistory: {
        orderBy: { createdAt: "desc" },
        include: { changedBy: { select: { firstName: true, lastName: true, phone: true } } },
      },
      user: { select: { id: true, firstName: true, lastName: true, phone: true, email: true } },
    },
  });

  if (!order) {
    throw new NotFoundError("Order");
  }

  return { order };
}

export async function updateOrderTracking(orderId: string, trackingNumber: string, actorId?: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) {
    throw new NotFoundError("Order");
  }

  const before = { trackingNumber: order.trackingNumber };
  const updated = await prisma.order.update({
    where: { id: orderId },
    data: { trackingNumber },
  });

  if (actorId) {
    await logAudit({
      userId: actorId,
      action: "UPDATE",
      entityType: "Order",
      entityId: orderId,
      metadata: buildChangeMetadata(before, { trackingNumber }),
    });
  }

  return { order: updated };
}

export async function cancelOrder(orderId: string, reason?: string, actorId?: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true, payment: true },
  });
  if (!order) {
    throw new NotFoundError("Order");
  }

  if (order.status === "CANCELLED") {
    throw new BadRequestError("سفارش قبلاً لغو شده است");
  }

  if (order.status === "DELIVERED") {
    throw new BadRequestError("سفارش تحویل‌شده را نمی‌توان لغو کرد");
  }

  await prisma.$transaction(async (tx) => {
    await tx.order.update({
      where: { id: orderId },
      data: {
        status: "CANCELLED",
        paymentStatus: order.paymentStatus === "COMPLETED" ? "REFUNDED" : "FAILED",
        notes: reason ? `${order.notes ?? ""}\n[${new Date().toISOString()}] لغو: ${reason}`.trim() : order.notes,
      },
    });

    for (const item of order.items) {
      await tx.product.update({
        where: { id: item.productId },
        data: { stockQuantity: { increment: item.quantity } },
      });
    }

    await tx.orderStatusHistory.create({
      data: {
        orderId,
        previousStatus: order.status,
        newStatus: "CANCELLED",
        changedById: actorId,
        note: reason,
      },
    });

    if (order.payment?.status === "COMPLETED") {
      await tx.transaction.create({
        data: {
          orderId: order.id,
          paymentId: order.payment.id,
          type: "REFUND",
          amount: order.payment.amount,
          status: "COMPLETED",
          gateway: order.payment.gateway,
          metadata: { reason: reason ?? "Order cancelled" },
        },
      });
    }
  });

  if (actorId) {
    await logAudit({
      userId: actorId,
      action: "CANCEL",
      entityType: "Order",
      entityId: orderId,
      metadata: { previousStatus: order.status, reason },
    });
  }

  return { success: true };
}

function generateOrderNumber(): string {
  const prefix = "JLF";
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, "0");
  return `${prefix}-${timestamp}-${random}`;
}
