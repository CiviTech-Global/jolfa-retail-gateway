import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import type { OrdersByStatusPoint } from '../types'

interface OrdersByStatusChartProps {
  data: OrdersByStatusPoint[]
}

const statusLabels: Record<string, string> = {
  PENDING: 'در انتظار',
  PROCESSING: 'در حال پردازش',
  SHIPPED: 'ارسال شده',
  DELIVERED: 'تحویل داده شده',
  CANCELLED: 'لغو شده',
}

const colors = [
  'hsl(38 92% 55%)',
  'hsl(199 89% 48%)',
  'hsl(258 90% 58%)',
  'hsl(158 64% 42%)',
  'hsl(0 84% 60%)',
]

export function OrdersByStatusChart({ data }: OrdersByStatusChartProps) {
  const chartData = data.map((item) => ({
    name: statusLabels[item.status] ?? item.status,
    value: item.count,
  }))

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={90}
            paddingAngle={4}
            dataKey="value"
          >
            {chartData.map((_, index) => (
              <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: 'var(--surface)',
              borderColor: 'var(--border)',
              borderRadius: '0.75rem',
              color: 'var(--foreground)',
            }}
          />
          <Legend
            verticalAlign="bottom"
            height={36}
            iconType="circle"
            formatter={(value) => <span className="text-muted-foreground">{value}</span>}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
