import { formatPrice } from '@/lib/utils'
import type { SalesTrendPoint } from '../types'

interface SalesTrendWidgetProps {
  data: SalesTrendPoint[]
}

export function SalesTrendWidget({ data }: SalesTrendWidgetProps) {
  const maxSales = Math.max(...data.map((point) => point.sales), 1)

  return (
    <div className="rounded-xl border border-border bg-background p-5 shadow-sm">
      <h3 className="mb-4 font-semibold text-foreground">روند فروش (۷ روز اخیر)</h3>
      <div className="space-y-3">
        {data.map((point) => {
          const widthPercent = (point.sales / maxSales) * 100
          const label = new Date(point.date).toLocaleDateString('fa-IR', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
          })

          return (
            <div key={point.date} className="flex items-center gap-3">
              <span className="w-20 shrink-0 text-sm text-gray-500">{label}</span>
              <div className="flex-1">
                <div className="h-2.5 w-full rounded-full bg-muted">
                  <div
                    className="h-2.5 rounded-full bg-primary transition-all"
                    style={{ width: `${widthPercent}%` }}
                  />
                </div>
              </div>
              <span className="w-24 shrink-0 text-left text-sm font-medium text-foreground">
                {formatPrice(point.sales)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
