import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ArrowRight, Info } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { FormError, FormField } from '@/components/ui/FormField'
import { Seo } from '@/components/seo/Seo'
import { iranMobileSchema, passwordSchema, toEnglishDigits } from '@/lib/validation'
import { forgotPassword, resetPassword } from '../api'

const phoneStepSchema = z.object({ phone: iranMobileSchema })
type PhoneStepValues = z.input<typeof phoneStepSchema>
type PhoneStepOutput = z.output<typeof phoneStepSchema>

const codeStepSchema = z
  .object({
    code: z.preprocess(
      (value) => (typeof value === 'string' ? toEnglishDigits(value).trim() : value),
      z
        .string({ required_error: 'کد تأیید الزامی است' })
        .regex(/^\d{6}$/, 'کد تأیید باید ۶ رقم باشد'),
    ),
    newPassword: passwordSchema,
    confirmPassword: z
      .string({ required_error: 'تکرار رمز عبور الزامی است' })
      .min(1, 'تکرار رمز عبور الزامی است'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    path: ['confirmPassword'],
    message: 'رمز عبور و تکرار آن یکسان نیستند',
  })
type CodeStepValues = z.input<typeof codeStepSchema>
type CodeStepOutput = z.output<typeof codeStepSchema>

export function ForgotPasswordPage() {
  const navigate = useNavigate()
  const [phone, setPhone] = useState<string>()
  /** Present only when the server has no SMS provider configured. */
  const [devCode, setDevCode] = useState<string>()

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <Seo title="بازیابی رمز عبور" />
      <div className="rounded-xl border border-border bg-background p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-foreground">بازیابی رمز عبور</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {phone
            ? `کد ۶ رقمی ارسال‌شده به ${phone} را وارد کنید.`
            : 'شماره موبایل حساب خود را وارد کنید تا کد بازیابی برایتان ارسال شود.'}
        </p>

        {devCode && (
          <p className="mt-4 flex items-start gap-2 rounded-xl bg-warning-soft p-3 text-sm text-foreground">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              سرویس پیامک پیکربندی نشده است. کد بازیابی برای آزمایش:{' '}
              <strong className="font-mono tracking-widest">{devCode}</strong>
            </span>
          </p>
        )}

        <div className="mt-6">
          {phone ? (
            <CodeStep
              phone={phone}
              onDone={() => {
                toast.success('رمز عبور بازیابی شد. اکنون وارد شوید.')
                navigate('/login')
              }}
              onRestart={() => {
                setPhone(undefined)
                setDevCode(undefined)
              }}
            />
          ) : (
            <PhoneStep
              onSent={(sentPhone, code) => {
                setPhone(sentPhone)
                setDevCode(code)
              }}
            />
          )}
        </div>

        <p className="mt-6 text-center text-sm text-foreground">
          <Link to="/login" className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
            <ArrowRight className="h-4 w-4" />
            بازگشت به ورود
          </Link>
        </p>
      </div>
    </div>
  )
}

function PhoneStep({ onSent }: { onSent: (phone: string, devCode?: string) => void }) {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<PhoneStepValues, unknown, PhoneStepOutput>({
    resolver: zodResolver(phoneStepSchema),
    defaultValues: { phone: '' },
    mode: 'onBlur',
  })

  const onSubmit = async (values: PhoneStepOutput) => {
    try {
      const result = await forgotPassword(values.phone)
      onSent(values.phone, result.devCode)
    } catch (error) {
      setError('root', {
        type: 'server',
        message: error instanceof Error ? error.message : 'ارسال کد ناموفق بود',
      })
    }
  }

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

      <FormError message={errors.root?.message} />

      <Button type="submit" loading={isSubmitting} className="w-full">
        ارسال کد بازیابی
      </Button>
    </form>
  )
}

function CodeStep({
  phone,
  onDone,
  onRestart,
}: {
  phone: string
  onDone: () => void
  onRestart: () => void
}) {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CodeStepValues, unknown, CodeStepOutput>({
    resolver: zodResolver(codeStepSchema),
    defaultValues: { code: '', newPassword: '', confirmPassword: '' },
    mode: 'onBlur',
  })

  const onSubmit = async (values: CodeStepOutput) => {
    try {
      await resetPassword({ phone, code: values.code, newPassword: values.newPassword })
      onDone()
    } catch (error) {
      setError('code', {
        type: 'server',
        message: error instanceof Error ? error.message : 'بازیابی رمز عبور ناموفق بود',
      })
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      <FormField label="کد تأیید" required error={errors.code?.message} hint="۶ رقم، معتبر تا ۱۰ دقیقه">
        {(field) => (
          <Input
            {...field}
            inputMode="numeric"
            dir="ltr"
            maxLength={6}
            placeholder="------"
            autoComplete="one-time-code"
            className="text-center font-mono tracking-[0.5em]"
            {...register('code')}
          />
        )}
      </FormField>

      <FormField label="رمز عبور جدید" required error={errors.newPassword?.message} hint="حداقل ۶ کاراکتر">
        {(field) => (
          <Input {...field} type="password" dir="ltr" autoComplete="new-password" {...register('newPassword')} />
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

      <div className="flex gap-2">
        <Button type="button" variant="outline" onClick={onRestart} className="shrink-0">
          تغییر شماره
        </Button>
        <Button type="submit" loading={isSubmitting} className="flex-1">
          تغییر رمز عبور
        </Button>
      </div>
    </form>
  )
}
