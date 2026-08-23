import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link } from 'react-router'
import { KeyRound } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { FormError, FormField } from '@/components/ui/FormField'
import { PageHeader } from '@/components/layout/Breadcrumbs'
import { Seo } from '@/components/seo/Seo'
import { ScrollReveal } from '@/components/motion/ScrollReveal'
import { optionalEmailSchema, optionalText } from '@/lib/validation'
import { updateProfile } from '../api'
import { useAuth } from '../context'

const profileSchema = z.object({
  firstName: optionalText('نام', 100),
  lastName: optionalText('نام خانوادگی', 100),
  email: optionalEmailSchema,
})

type ProfileValues = z.input<typeof profileSchema>
type ProfileOutput = z.output<typeof profileSchema>

export function ProfileEditPage() {
  const { user, refreshUser } = useAuth()

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ProfileValues, unknown, ProfileOutput>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      firstName: user?.firstName ?? '',
      lastName: user?.lastName ?? '',
      email: user?.email ?? '',
    },
    mode: 'onBlur',
    reValidateMode: 'onChange',
  })

  const onSubmit = async (values: ProfileOutput) => {
    try {
      await updateProfile({
        // Empty means "clear it", which the server stores as null.
        firstName: values.firstName ?? null,
        lastName: values.lastName ?? null,
        email: values.email ?? null,
      })
      await refreshUser()
      toast.success('اطلاعات حساب به‌روزرسانی شد')
    } catch (error) {
      setError('root', {
        type: 'server',
        message: error instanceof Error ? error.message : 'ذخیره اطلاعات ناموفق بود',
      })
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <Seo title="ویرایش پروفایل" />
      <ScrollReveal>
        <PageHeader
          title="ویرایش پروفایل"
          description="نام و راه‌های ارتباطی خود را به‌روز کنید."
          backTo="/profile"
          breadcrumbs={[{ label: 'پنل کاربری', to: '/profile' }, { label: 'ویرایش پروفایل' }]}
        />

        <Card>
          <CardHeader>
            <CardTitle>اطلاعات شخصی</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="نام" error={errors.firstName?.message}>
                  {(field) => <Input {...field} autoComplete="given-name" {...register('firstName')} />}
                </FormField>
                <FormField label="نام خانوادگی" error={errors.lastName?.message}>
                  {(field) => <Input {...field} autoComplete="family-name" {...register('lastName')} />}
                </FormField>
              </div>

              <FormField label="ایمیل" error={errors.email?.message}>
                {(field) => (
                  <Input {...field} type="email" dir="ltr" autoComplete="email" {...register('email')} />
                )}
              </FormField>

              {/* Phone is the login identifier and is not self-editable. */}
              <FormField label="شماره موبایل" hint="شماره موبایل قابل تغییر نیست؛ برای تغییر با پشتیبانی تماس بگیرید.">
                {(field) => <Input {...field} value={user?.phone ?? ''} dir="ltr" disabled readOnly />}
              </FormField>

              <FormError message={errors.root?.message} />

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <Link
                  to="/profile/security"
                  className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                >
                  <KeyRound className="h-4 w-4" />
                  تغییر رمز عبور
                </Link>
                <Button type="submit" loading={isSubmitting}>
                  ذخیره تغییرات
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </ScrollReveal>
    </div>
  )
}
