import { useQuery } from '@tanstack/react-query'
import { getDashboardStats } from '../api'
import type { DashboardStats } from '../types'
import { KpiBentoGrid } from '../components/KpiBentoGrid'
import { SalesChart } from '../components/SalesChart'
import { OrdersByStatusChart } from '../components/OrdersByStatusChart'
import { RevenueBarChart } from '../components/RevenueBarChart'
import { RecentOrdersTable } from '../components/RecentOrdersTable'
import { TopProductsList } from '../components/TopProductsList'
import { QuickActionsWidget } from '../components/QuickActionsWidget'
import { RecentActivityWidget } from '../components/RecentActivityWidget'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { ScrollReveal } from '@/components/motion/ScrollReveal'

export function AdminDashboardPage() {
  const { data, isLoading } = useQuery<DashboardStats, Error>({
    queryKey: ['admin', 'dashboard'],
    queryFn: () => getDashboardStats(7),
  })

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 animate-pulse rounded-xl bg-muted" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-32 animate-pulse rounded-2xl bg-muted" />
          ))}
        </div>
      </div>
    )
  }

  const stats: DashboardStats | undefined = data

  return (
    <div className="space-y-6">
      <ScrollReveal>
        <div>
          <h1 className="text-2xl font-bold text-foreground md:text-3xl">داشبورد مدیریت</h1>
          <p className="mt-1 text-muted-foreground">خلاصه‌ای از عملکرد فروشگاه در یک نگاه.</p>
        </div>
      </ScrollReveal>

      <KpiBentoGrid stats={stats!} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <ScrollReveal className="lg:col-span-2">
          <QuickActionsWidget />
        </ScrollReveal>
        <ScrollReveal delay={0.1} className="lg:col-span-1">
          <RecentActivityWidget activity={stats?.recentActivity ?? []} />
        </ScrollReveal>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ScrollReveal>
          <Card>
            <CardHeader>
              <CardTitle>روند فروش</CardTitle>
            </CardHeader>
            <CardContent>
              <SalesChart data={stats?.salesTrend ?? []} />
            </CardContent>
          </Card>
        </ScrollReveal>

        <ScrollReveal delay={0.1}>
          <Card>
            <CardHeader>
              <CardTitle>سفارشات بر اساس وضعیت</CardTitle>
            </CardHeader>
            <CardContent>
              <OrdersByStatusChart data={stats?.ordersByStatus ?? []} />
            </CardContent>
          </Card>
        </ScrollReveal>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <ScrollReveal className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>درآمد روزانه</CardTitle>
            </CardHeader>
            <CardContent>
              <RevenueBarChart data={stats?.salesTrend ?? []} />
            </CardContent>
          </Card>
        </ScrollReveal>

        <ScrollReveal delay={0.1} className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>محصولات برتر</CardTitle>
            </CardHeader>
            <CardContent>
              <TopProductsList products={stats?.topProducts ?? []} />
            </CardContent>
          </Card>
        </ScrollReveal>
      </div>

      <ScrollReveal>
        <Card>
          <CardHeader>
            <CardTitle>سفارشات اخیر</CardTitle>
          </CardHeader>
          <CardContent>
            <RecentOrdersTable orders={stats?.recentOrders ?? []} />
          </CardContent>
        </Card>
      </ScrollReveal>
    </div>
  )
}
