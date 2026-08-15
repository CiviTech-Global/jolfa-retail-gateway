import { TrendingUp, TrendingDown, ShoppingBag, Package, AlertTriangle, DollarSign } from 'lucide-react'
import { AnimatedCounter } from '@/components/motion/AnimatedCounter'
import { formatPrice } from '@/lib/utils'
import type { DashboardStats } from '../types'

interface KpiBentoGridProps {
  stats: DashboardStats
}

export function KpiBentoGrid({ stats }: KpiBentoGridProps) {
  const items = [
    {
      title: 'کل فروش',
      value: stats.totalSales,
      formatted: formatPrice(stats.totalSales),
      icon: DollarSign,
      tint: 'bg-primary-soft text-primary',
      trend: '+۱۲٪',
      trendUp: true,
    },
    {
      title: 'کل سفارش‌ها',
      value: stats.totalOrders,
      formatted: String(stats.totalOrders),
      suffix: 'سفارش',
      icon: ShoppingBag,
      tint: 'bg-secondary-soft text-secondary',
      trend: '+۵٪',
      trendUp: true,
    },
    {
      title: 'سفارش‌های در انتظار',
      value: stats.pendingOrders,
      formatted: String(stats.pendingOrders),
      suffix: 'سفارش',
      icon: Package,
      tint: 'bg-warning-soft text-warning',
      trend: '-۲٪',
      trendUp: false,
    },
    {
      title: 'محصولات رو به اتمام',
      value: stats.lowStockProducts,
      formatted: String(stats.lowStockProducts),
      suffix: 'عدد',
      icon: AlertTriangle,
      tint: 'bg-danger-soft text-danger',
      trend: '+۱٪',
      trendUp: true,
    },
  ]

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((item) => (
        <div
          key={item.title}
          className="relative overflow-hidden rounded-2xl border border-border bg-surface p-5 shadow-sm transition-shadow hover:shadow-md"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-muted-foreground">{item.title}</p>
              <div className="mt-2 text-2xl font-bold text-foreground tabular-nums">
                {item.title === 'کل فروش' ? (
                  <AnimatedCounter value={item.value} suffix="" />
                ) : (
                  item.formatted
                )}
                {item.suffix && <span className="me-1 text-sm font-normal text-muted-foreground">{item.suffix}</span>}
              </div>
            </div>
            <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${item.tint}`}>
              <item.icon className="h-6 w-6" />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-1 text-sm">
            {item.trendUp ? (
              <TrendingUp className="h-4 w-4 text-success" />
            ) : (
              <TrendingDown className="h-4 w-4 text-danger" />
            )}
            <span className={item.trendUp ? 'text-success' : 'text-danger'}>{item.trend}</span>
            <span className="text-muted-foreground">این هفته</span>
          </div>
        </div>
      ))}
    </div>
  )
}
