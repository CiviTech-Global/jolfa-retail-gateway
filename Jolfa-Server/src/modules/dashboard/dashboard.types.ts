export interface DashboardRecentOrderUser {
  id: string;
  firstName: string | null;
  lastName: string | null;
  phone: string;
}

export interface DashboardRecentOrder {
  id: string;
  orderNumber: string;
  status: string;
  finalAmount: number;
  createdAt: Date;
  user: DashboardRecentOrderUser | null;
}

export interface SalesTrendPoint {
  date: string;
  sales: number;
}

export interface OrdersByStatusPoint {
  status: string;
  count: number;
}

export interface TopProductPoint {
  title: string;
  sold: number;
}

export interface DashboardStats {
  totalSales: number;
  totalOrders: number;
  pendingOrders: number;
  totalProducts: number;
  lowStockProducts: number;
  recentOrders: DashboardRecentOrder[];
  salesTrend: SalesTrendPoint[];
  ordersByStatus: OrdersByStatusPoint[];
  topProducts: TopProductPoint[];
}
