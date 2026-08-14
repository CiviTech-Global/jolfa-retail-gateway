import type { LucideIcon } from 'lucide-react'
import { formatPrice } from '@/lib/utils'

interface StatCardProps {
  title: string
  value: number
  suffix?: string
  icon: LucideIcon
  accent?: string
}

export function StatCard({ title, value, suffix, icon: Icon, accent = 'bg-primary/10 text-primary' }: StatCardProps) {
  const displayValue = suffix ? `${value.toLocaleString('fa-IR')} ${suffix}` : formatPrice(value)

  return (
    <div className="rounded-xl border border-border bg-background p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">{title}</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{displayValue}</p>
        </div>
        <div className={`flex h-12 w-12 items-center justify-center rounded-full ${accent}`}>
          <Icon className="h-6 w-6" />
        </div>
      </div>
    </div>
  )
}
