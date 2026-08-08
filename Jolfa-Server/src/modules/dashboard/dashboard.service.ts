import { prisma } from "../../shared/prisma.js";
import type { DashboardStats } from "./dashboard.types.js";

export async function getDashboardStats(): Promise<DashboardStats> {
  const [salesAggregate, totalOrders, pendingOrders, totalProducts, lowStockProducts, recentOrders] =
    await Promise.all([
      prisma.order.aggregate({
        where: { status: "DELIVERED" },
        _sum: { finalAmount: true },
      }),
      prisma.order.count(),
      prisma.order.count({ where: { status: "PENDING" } }),
      prisma.product.count(),
      prisma.product.count({ where: { stockQuantity: { lt: 5 } } }),
      prisma.order.findMany({
        take: 5,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          orderNumber: true,
          status: true,
          finalAmount: true,
          createdAt: true,
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              phone: true,
            },
          },
        },
      }),
    ]);

  return {
    totalSales: salesAggregate._sum.finalAmount ?? 0,
    totalOrders,
    pendingOrders,
    totalProducts,
    lowStockProducts,
    recentOrders,
  };
}
