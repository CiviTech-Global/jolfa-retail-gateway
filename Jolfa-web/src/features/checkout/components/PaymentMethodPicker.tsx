import { CalendarClock, CreditCard } from 'lucide-react'
import type { PaymentMethodId, PaymentMethodOption } from '@/features/orders/api'

interface PaymentMethodPickerProps {
  methods: PaymentMethodOption[]
  value: PaymentMethodId
  onChange: (method: PaymentMethodId) => void
  /** True while TorobPay is being asked whether this cart qualifies. */
  checking: boolean
}

const ICONS: Record<PaymentMethodId, typeof CreditCard> = {
  ZIBAL: CreditCard,
  TOROBPAY: CalendarClock,
}

/**
 * Card payment, and TorobPay instalments when TorobPay says this cart
 * qualifies. TorobPay's title and description are shown as TorobPay sends
 * them, which its integration guide asks for.
 *
 * Native radio inputs, styled like the delivery options above, so keyboard and
 * screen-reader behaviour comes for free.
 */
export function PaymentMethodPicker({ methods, value, onChange, checking }: PaymentMethodPickerProps) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-6">
      <h2 className="text-lg font-bold text-foreground">روش پرداخت</h2>
      <div className="mt-4 space-y-3" role="radiogroup" aria-label="روش پرداخت">
        {methods.map((method) => {
          const Icon = ICONS[method.id]
          return (
            <label
              key={method.id}
              className="flex cursor-pointer items-center gap-3 rounded-lg border border-border p-4 has-[:checked]:border-primary has-[:checked]:bg-primary-soft/40"
            >
              <input
                type="radio"
                name="paymentMethod"
                value={method.id}
                checked={value === method.id}
                onChange={() => onChange(method.id)}
                className="h-4 w-4 accent-primary"
              />
              <Icon className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
              <div className="min-w-0">
                <p className="font-medium text-foreground">{method.title}</p>
                <p className="text-sm text-muted-foreground">{method.description}</p>
              </div>
            </label>
          )
        })}
        {checking && (
          <div
            className="h-[74px] animate-pulse rounded-lg bg-muted"
            aria-label="در حال بررسی روش‌های پرداخت"
          />
        )}
      </div>
    </div>
  )
}
