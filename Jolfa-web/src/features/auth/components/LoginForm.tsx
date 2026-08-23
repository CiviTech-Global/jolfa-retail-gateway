import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { FormError, FormField } from '@/components/ui/FormField'
import { currentPasswordSchema, iranMobileSchema } from '@/lib/validation'

const loginSchema = z.object({
  phone: iranMobileSchema,
  // Length rules belong on registration: an existing account may predate them,
  // and echoing them here tells an attacker the password shape.
  password: currentPasswordSchema,
})

type LoginFormValues = z.input<typeof loginSchema>
export type LoginFormData = z.output<typeof loginSchema>

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
  } = useForm<LoginFormValues, unknown, LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { phone: '', password: '' },
    mode: 'onBlur',
    reValidateMode: 'onChange',
  })

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      <FormField label="شماره موبایل" required error={errors.phone?.message}>
        {(field) => (
          <Input
            {...field}
            type="tel"
            inputMode="tel"
            dir="ltr"
            placeholder="09123456789"
            autoComplete="tel"
            {...register('phone')}
          />
        )}
      </FormField>

      <FormField label="رمز عبور" required error={errors.password?.message}>
        {(field) => (
          <Input
            {...field}
            type="password"
            dir="ltr"
            placeholder="••••••"
            autoComplete="current-password"
            {...register('password')}
          />
        )}
      </FormField>

      <FormError message={error} />

      <Button type="submit" loading={isLoading} className="w-full">
        ورود
      </Button>
    </form>
  )
}
