import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'

const loginSchema = z.object({
  phone: z
    .string()
    .min(10, 'شماره موبایل باید حداقل ۱۰ رقم باشد')
    .max(15, 'شماره موبایل باید حداکثر ۱۵ رقم باشد'),
  password: z.string().min(6, 'رمز عبور باید حداقل ۶ کاراکتر باشد'),
})

export type LoginFormData = z.infer<typeof loginSchema>

interface LoginFormProps {
  onSubmit: (data: LoginFormData) => Promise<void> | void
  isLoading?: boolean
  error?: string
}

export function LoginForm({ onSubmit, isLoading, error }: LoginFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  })

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <label htmlFor="phone" className="mb-1 block text-sm font-medium text-foreground">
          شماره موبایل
        </label>
        <Input
          id="phone"
          type="tel"
          inputMode="tel"
          dir="ltr"
          placeholder="09123456789"
          autoComplete="tel"
          {...register('phone')}
        />
        {errors.phone && <p className="mt-1 text-sm text-red-600">{errors.phone.message}</p>}
      </div>

      <div>
        <label htmlFor="password" className="mb-1 block text-sm font-medium text-foreground">
          رمز عبور
        </label>
        <Input
          id="password"
          type="password"
          dir="ltr"
          placeholder="••••••"
          autoComplete="current-password"
          {...register('password')}
        />
        {errors.password && <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>}
      </div>

      {error && <p className="rounded-md bg-red-50 p-2 text-sm text-red-600">{error}</p>}

      <Button type="submit" loading={isLoading} className="w-full">
        ورود
      </Button>
    </form>
  )
}
