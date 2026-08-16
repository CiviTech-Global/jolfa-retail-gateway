import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import type { SalesTrendPoint } from '../types'

interface RevenueBarChartProps {
  data: SalesTrendPoint[]
}

export function RevenueBarChart({ data }: RevenueBarChartProps) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(value) => value.toLocaleString('fa-IR')}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'var(--surface)',
              borderColor: 'var(--border)',
              borderRadius: '0.75rem',
              color: 'var(--foreground)',
            }}
            formatter={(value) => [String(value), 'درآمد']}
          />
          <Bar dataKey="sales" fill="var(--secondary)" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
