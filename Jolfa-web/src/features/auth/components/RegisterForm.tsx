import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'

const registerSchema = z.object({
  firstName: z.string().max(100, 'نام حداکثر ۱۰۰ کاراکتر').optional(),
  lastName: z.string().max(100, 'نام خانوادگی حداکثر ۱۰۰ کاراکتر').optional(),
  email: z.union([z.string().email('ایمیل معتبر نیست'), z.literal('')]).optional(),
  phone: z
    .string()
    .min(10, 'شماره موبایل باید حداقل ۱۰ رقم باشد')
    .max(15, 'شماره موبایل باید حداکثر ۱۵ رقم باشد'),
  password: z.string().min(6, 'رمز عبور باید حداقل ۶ کاراکتر باشد'),
})

export type RegisterFormData = z.infer<typeof registerSchema>

interface RegisterFormProps {
  onSubmit: (data: RegisterFormData) => Promise<void> | void
  isLoading?: boolean
  error?: string
}

export function RegisterForm({ onSubmit, isLoading, error }: RegisterFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
  })

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="firstName" className="mb-1 block text-sm font-medium text-foreground">
            نام
          </label>
          <Input id="firstName" type="text" autoComplete="given-name" {...register('firstName')} />
          {errors.firstName && (
            <p className="mt-1 text-sm text-red-600">{errors.firstName.message}</p>
          )}
        </div>
        <div>
          <label htmlFor="lastName" className="mb-1 block text-sm font-medium text-foreground">
            نام خانوادگی
          </label>
          <Input id="lastName" type="text" autoComplete="family-name" {...register('lastName')} />
          {errors.lastName && (
            <p className="mt-1 text-sm text-red-600">{errors.lastName.message}</p>
          )}
        </div>
      </div>

      <div>
        <label htmlFor="email" className="mb-1 block text-sm font-medium text-foreground">
          ایمیل <span className="text-gray-400">(اختیاری)</span>
        </label>
        <Input
          id="email"
          type="email"
          dir="ltr"
          placeholder="you@example.com"
          autoComplete="email"
          {...register('email')}
        />
        {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>}
      </div>

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
          autoComplete="new-password"
          {...register('password')}
        />
        {errors.password && <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>}
      </div>

      {error && <p className="rounded-md bg-red-50 p-2 text-sm text-red-600">{error}</p>}

      <Button type="submit" loading={isLoading} className="w-full">
        ثبت‌نام
      </Button>
    </form>
  )
}
