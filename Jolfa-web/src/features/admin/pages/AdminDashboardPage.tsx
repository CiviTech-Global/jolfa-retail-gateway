import { useQuery } from '@tanstack/react-query'
import { DollarSign, Package, ShoppingBag, AlertTriangle } from 'lucide-react'
import { getDashboardStats } from '../api'
import { StatCard } from '../components/StatCard'
import { SalesTrendWidget } from '../components/SalesTrendWidget'
import { OrdersByStatusWidget } from '../components/OrdersByStatusWidget'
import { RecentOrdersWidget } from '../components/RecentOrdersWidget'
import { QuickActionsWidget } from '../components/QuickActionsWidget'

export function AdminDashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'dashboard'],
    queryFn: getDashboardStats,
  })

  if (isLoading) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-foreground">داشبورد مدیریت</h1>
        <p className="mt-2 text-gray-500">در حال بارگذاری ...</p>
      </div>
    )
  }

  const stats = data

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">داشبورد مدیریت</h1>
        <p className="mt-2 text-gray-600">خلاصه‌ای از عملکرد فروشگاه در یک نگاه.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="کل فروش"
          value={stats?.totalSales ?? 0}
          icon={DollarSign}
          accent="bg-green-100 text-green-700"
        />
        <StatCard
          title="کل سفارش‌ها"
          value={stats?.totalOrders ?? 0}
          suffix="سفارش"
          icon={ShoppingBag}
          accent="bg-blue-100 text-blue-700"
        />
        <StatCard
          title="سفارش‌های در انتظار"
          value={stats?.pendingOrders ?? 0}
          suffix="سفارش"
          icon={Package}
          accent="bg-amber-100 text-amber-700"
        />
        <StatCard
          title="محصولات رو به اتمام"
          value={stats?.lowStockProducts ?? 0}
          suffix="عدد"
          icon={AlertTriangle}
          accent="bg-red-100 text-red-700"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SalesTrendWidget data={stats?.salesTrend ?? []} />
        <OrdersByStatusWidget data={stats?.ordersByStatus ?? []} />
      </div>

      <RecentOrdersWidget orders={stats?.recentOrders ?? []} />

      <QuickActionsWidget />
    </div>
  )
}
