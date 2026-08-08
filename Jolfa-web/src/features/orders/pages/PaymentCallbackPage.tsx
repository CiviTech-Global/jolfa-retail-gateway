/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Button } from '@/components/ui/Button'
import { verifyPayment } from '../api'

export function PaymentCallbackPage() {
  const [searchParams] = useSearchParams()
  const [status, setStatus] = useState<'loading' | 'success' | 'failed'>('loading')
  const [refId, setRefId] = useState<string>()

  useEffect(() => {
    const authority = searchParams.get('Authority') ?? searchParams.get('authority') ?? ''
    const paymentStatus = searchParams.get('Status') ?? searchParams.get('status') ?? ''

    if (!authority) {
      setStatus('failed')
      return
    }

    verifyPayment(authority, paymentStatus)
      .then((result) => {
        if (result.success) {
          setStatus('success')
          setRefId(result.refId)
        } else {
          setStatus('failed')
        }
      })
      .catch(() => setStatus('failed'))
  }, [searchParams])

  if (status === 'loading') {
    return (
      <div className="mx-auto max-w-7xl px-4 py-20 text-center">
        <p className="text-gray-600">در حال بررسی نتیجه پرداخت ...</p>
      </div>
    )
  }

  if (status === 'success') {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <div className="rounded-xl border border-green-200 bg-green-50 p-8">
          <h1 className="text-2xl font-bold text-green-800">پرداخت موفق</h1>
          <p className="mt-2 text-green-700">سفارش شما با موفقیت ثبت شد.</p>
          {refId && <p className="mt-2 text-sm text-green-700">شناسه پرداخت: {refId}</p>}
          <Link to="/profile">
            <Button className="mt-6">مشاهده سفارش‌ها</Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-md px-4 py-20 text-center">
      <div className="rounded-xl border border-red-200 bg-red-50 p-8">
        <h1 className="text-2xl font-bold text-red-800">پرداخت ناموفق</h1>
        <p className="mt-2 text-red-700">متأسفانه پرداخت با خطا مواجه شد. لطفاً دوباره تلاش کنید.</p>
        <Link to="/cart">
          <Button variant="outline" className="mt-6">
            بازگشت به سبد خرید
          </Button>
        </Link>
      </div>
    </div>
  )
}
