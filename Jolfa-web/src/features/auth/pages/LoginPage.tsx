import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { LoginForm, type LoginFormData } from '../components/LoginForm'
import { useAuth } from '../context'

export function LoginPage() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string>()

  async function handleSubmit(data: LoginFormData) {
    setError(undefined)
    setIsLoading(true)
    try {
      await login(data)
      navigate('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا در ورود به حساب')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <div className="rounded-xl border border-border bg-background p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-foreground">ورود به حساب</h1>
        <p className="mt-2 text-sm text-gray-600">برای ادامه شماره موبایل و رمز عبور خود را وارد کنید.</p>

        <div className="mt-6">
          <LoginForm onSubmit={handleSubmit} isLoading={isLoading} error={error} />
        </div>

        <p className="mt-6 text-center text-sm text-foreground">
          حساب کاربری ندارید؟{' '}
          <Link to="/register" className="font-medium text-primary hover:underline">
            ثبت‌نام کنید
          </Link>
        </p>
      </div>
    </div>
  )
}
