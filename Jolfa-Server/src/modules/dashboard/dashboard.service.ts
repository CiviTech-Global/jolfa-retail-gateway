import { prisma } from "../../shared/prisma.js";
import type { DashboardStats } from "./dashboard.types.js";

function getDateRange(date: Date): { start: Date; end: Date } {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function formatDateKey(date: Date): string {
  return date.toISOString().split("T")[0];
}

async function getSalesTrend(days = 7): Promise<DashboardStats["salesTrend"]> {
  const today = new Date();
  const points: DashboardStats["salesTrend"] = [];

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const { start, end } = getDateRange(date);
    const aggregate = await prisma.order.aggregate({
      where: {
        status: "DELIVERED",
        createdAt: { gte: start, lte: end },
      },
      _sum: { finalAmount: true },
    });

    points.push({
      date: formatDateKey(date),
      sales: aggregate._sum.finalAmount ?? 0,
    });
  }

  return points;
}

async function getOrdersByStatus(): Promise<DashboardStats["ordersByStatus"]> {
  const groups = await prisma.order.groupBy({
    by: ["status"],
    _count: { status: true },
  });

  return groups.map((group) => ({
    status: group.status,
    count: group._count.status,
  }));
}

async function getTopProducts(limit = 5): Promise<DashboardStats["topProducts"]> {
  const topItems = await prisma.orderItem.groupBy({
    by: ["productId"],
    _sum: { quantity: true },
    orderBy: { _sum: { quantity: "desc" } },
    take: limit,
  });

  if (topItems.length === 0) return [];

  const productIds = topItems.map((item) => item.productId);
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, title: true },
  });
  const titleMap = new Map(products.map((p) => [p.id, p.title]));

  return topItems.map((item) => ({
    title: titleMap.get(item.productId) ?? "نامشخص",
    sold: item._sum.quantity ?? 0,
  }));
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const [salesAggregate, totalOrders, pendingOrders, totalProducts, lowStockProducts, recentOrders, salesTrend, ordersByStatus, topProducts] =
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
      getSalesTrend(),
      getOrdersByStatus(),
      getTopProducts(),
    ]);

  return {
    totalSales: salesAggregate._sum.finalAmount ?? 0,
    totalOrders,
    pendingOrders,
    totalProducts,
    lowStockProducts,
    recentOrders,
    salesTrend,
    ordersByStatus,
    topProducts,
  };
}
