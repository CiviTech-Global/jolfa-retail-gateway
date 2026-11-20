import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { TicketPercent, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { validateDiscountCode } from '@/features/orders/api'

interface DiscountCodeFieldProps {
  subtotal: number
  /** The code currently applied, or null. */
  applied: string | null
  /** Why the applied code stopped applying (the cart changed), if it did. */
  appliedError?: string
  onApply: (code: string) => void
  onRemove: () => void
}

/**
 * Typing a code checks it against the server straight away, so the customer
 * learns why a code does not work here, not after pressing pay. The amount it
 * takes off is still decided again by the server when the order is placed.
 */
export function DiscountCodeField({ subtotal, applied, appliedError, onApply, onRemove }: DiscountCodeFieldProps) {
  const [value, setValue] = useState('')
  const [error, setError] = useState<string>()

  const check = useMutation({
    mutationFn: (code: string) => validateDiscountCode(code, subtotal),
    onSuccess: (preview) => {
      setError(undefined)
      setValue('')
      onApply(preview.code)
    },
    onError: (err: Error) => setError(err.message),
  })

  if (applied) {
    return (
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-2 rounded-lg border border-success/40 bg-success-soft px-3 py-2">
          <span className="flex items-center gap-2 text-sm text-success">
            <TicketPercent className="h-4 w-4" aria-hidden="true" />
            کد <span className="ltr-text font-mono font-medium">{applied}</span> اعمال شد
          </span>
          <button
            type="button"
            onClick={onRemove}
            className="rounded p-1 text-muted-foreground hover:text-danger"
            aria-label="حذف کد تخفیف"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {appliedError && (
          <p role="alert" className="text-sm text-danger">
            {appliedError}
          </p>
        )}
      </div>
    )
  }

  const submit = () => {
    const code = value.trim()
    if (!code) {
      setError('کد تخفیف را وارد کنید.')
      return
    }
    check.mutate(code)
  }

  return (
    <div className="space-y-1">
      <label htmlFor="discount-code" className="text-sm font-medium text-foreground">
        کد تخفیف
      </label>
      <div className="flex gap-2">
        <Input
          id="discount-code"
          value={value}
          onChange={(event) => {
            setValue(event.target.value)
            setError(undefined)
          }}
          // Inside the checkout form: Enter must apply the code, not place the order.
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              submit()
            }
          }}
          dir="ltr"
          autoComplete="off"
          placeholder="مثلاً YALDA1405"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? 'discount-code-error' : undefined}
          className="font-mono"
        />
        <Button type="button" variant="outline" loading={check.isPending} onClick={submit}>
          اعمال
        </Button>
      </div>
      {error && (
        <p id="discount-code-error" role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  )
}
