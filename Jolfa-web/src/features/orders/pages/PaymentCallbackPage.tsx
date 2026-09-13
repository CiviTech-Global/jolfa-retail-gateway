/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Button } from '@/components/ui/Button'
import { verifyPayment } from '../api'

/**
 * Where the customer lands after paying.
 *
 * The payment is already settled by the time this renders: Zibal returns the
 * browser to the API's callback route, which asks Zibal what actually happened,
 * writes the outcome, and only then redirects here with the result in the query
 * string. So the normal path is to display what the server decided.
 *
 * The verify call below is the fallback for arriving here without that result —
 * an old bookmark, or a customer who reopened the tab. It is safe to repeat:
 * verification is idempotent, and a settled payment short-circuits before the
 * gateway is contacted again.
 */
export function PaymentCallbackPage() {
  const [searchParams] = useSearchParams()
  const [status, setStatus] = useState<'loading' | 'success' | 'failed'>('loading')
  const [refId, setRefId] = useState<string>()
  const [reason, setReason] = useState<string>()

  useEffect(() => {
    const authority = searchParams.get('authority') ?? searchParams.get('Authority') ?? ''
    const outcome = searchParams.get('status') ?? searchParams.get('Status') ?? ''

    // The server already told us the answer.
    if (outcome === 'OK') {
      setRefId(searchParams.get('refId') ?? undefined)
      setStatus('success')
      return
    }
    if (outcome === 'NOK') {
      setReason(searchParams.get('reason') ?? undefined)
      setStatus('failed')
      return
    }

    if (!authority) {
      setStatus('failed')
      return
    }

    verifyPayment(authority, outcome)
      .then((result) => {
        if (result.success) {
          setRefId(result.refId)
          setStatus('success')
        } else {
          setStatus('failed')
        }
      })
      .catch(() => setStatus('failed'))
  }, [searchParams])

  if (status === 'loading') {
    return (
      <div className="mx-auto max-w-7xl px-4 py-20 text-center">
        <p className="text-muted-foreground">در حال بررسی نتیجه پرداخت ...</p>
      </div>
    )
  }

  if (status === 'success') {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <div className="rounded-2xl border border-success/30 bg-success-soft p-8">
          <h1 className="text-2xl font-semibold text-success">پرداخت موفق</h1>
          <p className="mt-2 text-success">سفارش شما با موفقیت ثبت شد.</p>
          {refId && (
            <p className="mt-3 text-sm text-success">
              شناسه پیگیری: <span className="ltr-text tabular-nums font-medium">{refId}</span>
            </p>
          )}
          <Link to="/profile">
            <Button className="mt-6">مشاهده سفارش‌ها</Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-md px-4 py-20 text-center">
      <div className="rounded-2xl border border-danger/30 bg-danger-soft p-8">
        <h1 className="text-2xl font-semibold text-danger">پرداخت ناموفق</h1>
        {/* The gateway's own words where we have them — "موجودی حساب کافی نیست"
            tells the customer what to do next; a generic failure does not. */}
        <p className="mt-2 text-danger">
          {reason ?? 'متأسفانه پرداخت با خطا مواجه شد. لطفاً دوباره تلاش کنید.'}
        </p>
        <p className="mt-3 text-sm text-muted-foreground">
          اگر مبلغی از حساب شما کسر شده باشد، طی ۷۲ ساعت به‌صورت خودکار بازگردانده می‌شود.
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <Link to="/cart">
            <Button>بازگشت به سبد خرید</Button>
          </Link>
          <Link to="/profile">
            <Button variant="outline">سفارش‌های من</Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
