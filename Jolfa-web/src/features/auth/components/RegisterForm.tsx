import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { FormError, FormField } from '@/components/ui/FormField'
import { iranMobileSchema, optionalEmailSchema, optionalText, passwordSchema } from '@/lib/validation'

const registerSchema = z
  .object({
    firstName: optionalText('نام', 100),
    lastName: optionalText('نام خانوادگی', 100),
    email: optionalEmailSchema,
    phone: iranMobileSchema,
    password: passwordSchema,
    confirmPassword: z.string({ required_error: 'تکرار رمز عبور الزامی است' }).min(1, 'تکرار رمز عبور الزامی است'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ['confirmPassword'],
    message: 'رمز عبور و تکرار آن یکسان نیستند',
  })

type RegisterFormValues = z.input<typeof registerSchema>
type RegisterFormOutput = z.output<typeof registerSchema>

/** The confirmation field is client-only; the API never receives it. */
export type RegisterFormData = Omit<RegisterFormOutput, 'confirmPassword'>

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
  } = useForm<RegisterFormValues, unknown, RegisterFormOutput>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      password: '',
      confirmPassword: '',
    },
    mode: 'onBlur',
    reValidateMode: 'onChange',
  })

  const submit = (values: RegisterFormOutput) => {
    const { confirmPassword, ...data } = values
    void confirmPassword // client-only field, never sent to the API
    return onSubmit(data)
  }

  return (
    <form onSubmit={handleSubmit(submit)} noValidate className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="نام" error={errors.firstName?.message}>
          {(field) => <Input {...field} type="text" autoComplete="given-name" {...register('firstName')} />}
        </FormField>
        <FormField label="نام خانوادگی" error={errors.lastName?.message}>
          {(field) => <Input {...field} type="text" autoComplete="family-name" {...register('lastName')} />}
        </FormField>
      </div>

      <FormField label="ایمیل" error={errors.email?.message}>
        {(field) => (
          <Input
            {...field}
            type="email"
            dir="ltr"
            placeholder="you@example.com"
            autoComplete="email"
            {...register('email')}
          />
        )}
      </FormField>

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

      <FormField
        label="رمز عبور"
        required
        error={errors.password?.message}
        hint="حداقل ۶ کاراکتر"
      >
        {(field) => (
          <Input
            {...field}
            type="password"
            dir="ltr"
            placeholder="••••••"
            autoComplete="new-password"
            {...register('password')}
          />
        )}
      </FormField>

      <FormField label="تکرار رمز عبور" required error={errors.confirmPassword?.message}>
        {(field) => (
          <Input
            {...field}
            type="password"
            dir="ltr"
            placeholder="••••••"
            autoComplete="new-password"
            {...register('confirmPassword')}
          />
        )}
      </FormField>

      <FormError message={error} />

      <Button type="submit" loading={isLoading} className="w-full">
        ثبت‌نام
      </Button>
    </form>
  )
}
