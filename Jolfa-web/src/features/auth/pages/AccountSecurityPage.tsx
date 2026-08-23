import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { KeyRound, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { FormError, FormField } from '@/components/ui/FormField'
import { PageHeader } from '@/components/layout/Breadcrumbs'
import { Seo } from '@/components/seo/Seo'
import { ScrollReveal } from '@/components/motion/ScrollReveal'
import { ApiError } from '@/api/errors'
import { passwordSchema } from '@/lib/validation'
import { changePassword } from '../api'
import { useAuth } from '../context'

const changePasswordSchema = z
  .object({
    currentPassword: z
      .string({ required_error: 'رمز عبور فعلی الزامی است' })
      .min(1, 'رمز عبور فعلی الزامی است'),
    newPassword: passwordSchema,
    confirmPassword: z
      .string({ required_error: 'تکرار رمز عبور الزامی است' })
      .min(1, 'تکرار رمز عبور الزامی است'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    path: ['confirmPassword'],
    message: 'رمز عبور جدید و تکرار آن یکسان نیستند',
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    path: ['newPassword'],
    message: 'رمز عبور جدید نباید با رمز فعلی یکسان باشد',
  })

type ChangePasswordValues = z.infer<typeof changePasswordSchema>

export function AccountSecurityPage() {
  const { user } = useAuth()

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
    mode: 'onBlur',
    reValidateMode: 'onChange',
  })

  const onSubmit = async (values: ChangePasswordValues) => {
    try {
      await changePassword({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      })
      reset()
      toast.success('رمز عبور با موفقیت تغییر کرد')
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setError('currentPassword', { type: 'server', message: 'رمز عبور فعلی درست نیست' })
        return
      }
      setError('root', {
        type: 'server',
        message: error instanceof Error ? error.message : 'تغییر رمز عبور ناموفق بود',
      })
    }
  }

  const isAdmin = user?.role === 'ADMIN'

  return (
    <div className="max-w-2xl">
      <Seo title="امنیت حساب" />
      <ScrollReveal>
        <PageHeader
          title="امنیت حساب"
          description="رمز عبور خود را تغییر دهید."
          backTo={isAdmin ? '/admin' : '/profile'}
          breadcrumbs={[
            { label: 'پنل کاربری', to: '/profile' },
            { label: 'امنیت حساب' },
          ]}
        />

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-primary" />
              تغییر رمز عبور
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
              <FormField label="رمز عبور فعلی" required error={errors.currentPassword?.message}>
                {(field) => (
                  <Input
                    {...field}
                    type="password"
                    dir="ltr"
                    autoComplete="current-password"
                    {...register('currentPassword')}
                  />
                )}
              </FormField>

              <FormField
                label="رمز عبور جدید"
                required
                error={errors.newPassword?.message}
                hint="حداقل ۶ کاراکتر"
              >
                {(field) => (
                  <Input
                    {...field}
                    type="password"
                    dir="ltr"
                    autoComplete="new-password"
                    {...register('newPassword')}
                  />
                )}
              </FormField>

              <FormField label="تکرار رمز عبور جدید" required error={errors.confirmPassword?.message}>
                {(field) => (
                  <Input
                    {...field}
                    type="password"
                    dir="ltr"
                    autoComplete="new-password"
                    {...register('confirmPassword')}
                  />
                )}
              </FormField>

              <FormError message={errors.root?.message} />

              <div className="flex items-center justify-between gap-3 pt-2">
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  رمز عبور شما به صورت رمزنگاری‌شده ذخیره می‌شود.
                </p>
                <Button type="submit" loading={isSubmitting}>
                  ذخیره رمز جدید
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </ScrollReveal>
    </div>
  )
}
