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

export interface DashboardStats {
  totalSales: number;
  totalOrders: number;
  pendingOrders: number;
  totalProducts: number;
  lowStockProducts: number;
  recentOrders: DashboardRecentOrder[];
}
