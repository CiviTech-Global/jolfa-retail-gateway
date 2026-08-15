import { formatPrice } from '@/lib/utils'

interface OrderSummaryProps {
  itemCount: number
  subtotal: number
  shippingCost?: number
  discount?: number
}

export function OrderSummary({
  itemCount,
  subtotal,
  shippingCost = 0,
  discount = 0,
}: OrderSummaryProps) {
  const total = subtotal + shippingCost - discount

  return (
    <div className="space-y-3 text-sm">
      <div className="flex justify-between text-muted-foreground">
        <span>تعداد کالا</span>
        <span className="text-foreground">{itemCount} عدد</span>
      </div>
      <div className="flex justify-between text-muted-foreground">
        <span>مجموع</span>
        <span className="text-foreground tabular-nums">{formatPrice(subtotal)}</span>
      </div>
      {shippingCost > 0 && (
        <div className="flex justify-between text-muted-foreground">
          <span>هزینه ارسال</span>
          <span className="text-foreground tabular-nums">{formatPrice(shippingCost)}</span>
        </div>
      )}
      {discount > 0 && (
        <div className="flex justify-between text-success">
          <span>تخفیف</span>
          <span className="tabular-nums">-{formatPrice(discount)}</span>
        </div>
      )}
      <div className="border-t border-border pt-3">
        <div className="flex justify-between text-lg font-bold">
          <span className="text-foreground">قابل پرداخت</span>
          <span className="text-primary tabular-nums">{formatPrice(total)}</span>
        </div>
      </div>
    </div>
  )
}
