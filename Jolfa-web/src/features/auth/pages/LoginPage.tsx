import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { LoginForm, type LoginFormData } from '../components/LoginForm'
import { useAuth } from '../context'
import { isAdmin, roleHome } from '../roles'

interface LoginLocationState {
  /** Set by ProtectedRoute when it bounced the user here. */
  from?: { pathname?: string }
}

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { login } = useAuth()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string>()

  const redirectedFrom = (location.state as LoginLocationState | null)?.from?.pathname

  async function handleSubmit(data: LoginFormData) {
    setError(undefined)
    setIsLoading(true)
    try {
      // Admins and customers share this form; only the destination differs.
      const user = await login(data)
      toast.success('با موفقیت وارد شدید')

      // A customer who was bounced off an admin URL would only be bounced
      // again, so send them to their own panel instead.
      const canReturn =
        redirectedFrom && (!redirectedFrom.startsWith('/admin') || isAdmin(user))

      navigate(canReturn ? redirectedFrom : roleHome(user), { replace: true })
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
        <p className="mt-2 text-sm text-muted-foreground">برای ادامه شماره موبایل و رمز عبور خود را وارد کنید.</p>

        <div className="mt-6">
          <LoginForm onSubmit={handleSubmit} isLoading={isLoading} error={error} />
        </div>

        <p className="mt-4 text-center text-sm">
          <Link to="/forgot-password" className="font-medium text-primary hover:underline">
            رمز عبور خود را فراموش کرده‌اید؟
          </Link>
        </p>

        <p className="mt-4 text-center text-sm text-foreground">
          حساب کاربری ندارید؟{' '}
          <Link to="/register" className="font-medium text-primary hover:underline">
            ثبت‌نام کنید
          </Link>
        </p>
      </div>
    </div>
  )
}
