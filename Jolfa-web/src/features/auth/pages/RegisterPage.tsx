import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { RegisterForm, type RegisterFormData } from '../components/RegisterForm'
import { useAuth } from '../context'

export function RegisterPage() {
  const navigate = useNavigate()
  const { register } = useAuth()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string>()

  async function handleSubmit(data: RegisterFormData) {
    setError(undefined)
    setIsLoading(true)
    try {
      await register({
        ...data,
        email: data.email || undefined,
      })
      navigate('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا در ثبت‌نام')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <div className="rounded-xl border border-border bg-background p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-foreground">ثبت‌نام</h1>
        <p className="mt-2 text-sm text-gray-600">حساب کاربری جدید بسازید و از خرید لذت ببرید.</p>

        <div className="mt-6">
          <RegisterForm onSubmit={handleSubmit} isLoading={isLoading} error={error} />
        </div>

        <p className="mt-6 text-center text-sm text-foreground">
          قبلاً ثبت‌نام کرده‌اید؟{' '}
          <Link to="/login" className="font-medium text-primary hover:underline">
            وارد شوید
          </Link>
        </p>
      </div>
    </div>
  )
}
