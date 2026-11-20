import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Pencil, Plus, TicketPercent, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { formatDate, formatNumber, formatPrice } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Switch } from '@/components/ui/Switch'
import { Badge } from '@/components/ui/Badge'
import { DataTable } from '@/components/ui/DataTable'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogForm,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog'
import { FormField } from '@/components/ui/FormField'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select'
import { ScrollReveal } from '@/components/motion/ScrollReveal'
import { useConfirmDialog } from '@/hooks/useConfirmDialog'
import { ApiError } from '@/api/errors'
import { numericField, optionalText, toEnglishDigits } from '@/lib/validation'
import {
  createDiscountCode,
  deleteDiscountCode,
  getDiscountCodes,
  updateDiscountCode,
} from '@/features/admin/api'
import type { DiscountCodeBody, DiscountCodeDto } from '@/features/admin/types'

/** Iran has kept one offset all year since 1401. Dates are the shop's days, not UTC's. */
const IRAN_OFFSET = '+03:30'

/** An ISO instant as the YYYY-MM-DD it falls on in Tehran, for a date input. */
function toTehranDate(iso: string | null): string {
  if (!iso) return ''
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tehran' }).format(new Date(iso))
}

const codeSchema = z
  .string()
  .transform((value) => toEnglishDigits(value).replace(/\s+/g, '').toUpperCase())
  .refine((value) => /^[A-Z0-9_-]{3,30}$/.test(value), {
    message: 'کد باید ۳ تا ۳۰ حرف انگلیسی، عدد، - یا _ باشد',
  })

const dateField = z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/, 'تاریخ معتبر نیست')

const formSchema = z
  .object({
    code: codeSchema,
    description: optionalText('توضیح', 200),
    type: z.enum(['PERCENT', 'FIXED']),
    value: numericField('مقدار تخفیف', { min: 1 }),
    maxDiscountAmount: numericField('سقف تخفیف', { required: false, min: 1 }),
    minOrderAmount: numericField('حداقل مبلغ خرید', { required: false, min: 0 }),
    startsAt: dateField,
    expiresAt: dateField,
    usageLimit: numericField('سقف کل استفاده', { required: false, min: 1 }),
    perUserLimit: numericField('سقف استفاده هر مشتری', { required: false, min: 1 }),
    isActive: z.boolean(),
  })
  .refine((data) => data.type !== 'PERCENT' || (data.value as number) <= 100, {
    path: ['value'],
    message: 'درصد تخفیف حداکثر ۱۰۰ است',
  })
  .refine((data) => !data.startsAt || !data.expiresAt || data.expiresAt >= data.startsAt, {
    path: ['expiresAt'],
    message: 'تاریخ پایان باید بعد از تاریخ شروع باشد',
  })

type FormValues = z.input<typeof formSchema>
type FormOutput = z.output<typeof formSchema>

function emptyValues(): FormValues {
  return {
    code: '',
    description: '',
    type: 'PERCENT',
    value: '',
    maxDiscountAmount: '',
    minOrderAmount: '',
    startsAt: '',
    expiresAt: '',
    usageLimit: '',
    // Once per customer unless the owner says otherwise.
    perUserLimit: '1',
    isActive: true,
  }
}

function toValues(code: DiscountCodeDto): FormValues {
  const text = (value: number | null) => (value === null ? '' : String(value))
  return {
    code: code.code,
    description: code.description ?? '',
    type: code.type,
    value: String(code.value),
    maxDiscountAmount: text(code.maxDiscountAmount),
    minOrderAmount: code.minOrderAmount ? String(code.minOrderAmount) : '',
    startsAt: toTehranDate(code.startsAt),
    expiresAt: toTehranDate(code.expiresAt),
    usageLimit: text(code.usageLimit),
    perUserLimit: text(code.perUserLimit),
    isActive: code.isActive,
  }
}

function toBody(data: FormOutput): DiscountCodeBody {
  const orNull = (value: unknown) => (typeof value === 'number' ? value : null)
  return {
    code: data.code,
    description: data.description ?? null,
    type: data.type,
    value: data.value as number,
    maxDiscountAmount: data.type === 'PERCENT' ? orNull(data.maxDiscountAmount) : null,
    minOrderAmount: orNull(data.minOrderAmount) ?? 0,
    // A start date means from the first moment of that day, an end date until
    // the last, both in the shop's time zone.
    startsAt: data.startsAt ? `${data.startsAt}T00:00:00${IRAN_OFFSET}` : null,
    expiresAt: data.expiresAt ? `${data.expiresAt}T23:59:59${IRAN_OFFSET}` : null,
    usageLimit: orNull(data.usageLimit),
    perUserLimit: orNull(data.perUserLimit),
    isActive: data.isActive,
  }
}

function describeValue(code: DiscountCodeDto): string {
  if (code.type === 'FIXED') return formatPrice(code.value)
  const percent = `${formatNumber(code.value)}٪`
  return code.maxDiscountAmount ? `${percent} (تا ${formatPrice(code.maxDiscountAmount)})` : percent
}

/** Inactive, not yet started, expired, used up, or live. */
function statusOf(code: DiscountCodeDto): { label: string; variant: 'success' | 'warning' | 'danger' } {
  const now = Date.now()
  if (!code.isActive) return { label: 'غیرفعال', variant: 'danger' }
  if (code.expiresAt && new Date(code.expiresAt).getTime() <= now) return { label: 'منقضی', variant: 'danger' }
  if (code.startsAt && new Date(code.startsAt).getTime() > now) return { label: 'زمان‌بندی‌شده', variant: 'warning' }
  if (code.usageLimit !== null && code.paidUses >= code.usageLimit) return { label: 'تمام‌شده', variant: 'warning' }
  return { label: 'فعال', variant: 'success' }
}

export function AdminDiscountCodesPage() {
  const queryClient = useQueryClient()
  const { confirm, Dialog: ConfirmDialogComponent } = useConfirmDialog()
  const [isOpen, setIsOpen] = useState(false)
  const [editing, setEditing] = useState<DiscountCodeDto | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'discount-codes'],
    queryFn: getDiscountCodes,
  })

  const {
    register,
    handleSubmit,
    control,
    reset,
    setError,
    formState: { errors },
  } = useForm<FormValues, unknown, FormOutput>({
    resolver: zodResolver(formSchema),
    defaultValues: emptyValues(),
    mode: 'onBlur',
    reValidateMode: 'onChange',
  })
  const type = useWatch({ control, name: 'type' })

  useEffect(() => {
    if (isOpen) reset(editing ? toValues(editing) : emptyValues())
  }, [isOpen, editing, reset])

  const closeDialog = () => {
    setIsOpen(false)
    setEditing(null)
  }

  const onError = (error: unknown, fallback: string) => {
    if (error instanceof ApiError && error.fieldErrors) {
      let matched = false
      for (const [field, messages] of Object.entries(error.fieldErrors)) {
        const root = field.split('.')[0] as keyof FormValues
        if (root in emptyValues() && messages[0]) {
          setError(root, { type: 'server', message: messages[0] })
          matched = true
        }
      }
      if (matched) return
    }
    toast.error(error instanceof Error ? error.message : fallback)
  }

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['admin', 'discount-codes'] })

  const saveMutation = useMutation({
    mutationFn: (body: DiscountCodeBody) =>
      editing ? updateDiscountCode(editing.id, body) : createDiscountCode(body),
    onSuccess: () => {
      void refresh()
      toast.success(editing ? 'کد تخفیف به‌روزرسانی شد' : 'کد تخفیف ایجاد شد')
      closeDialog()
    },
    onError: (error) => onError(error, 'ذخیره کد تخفیف ناموفق بود'),
  })

  const deleteMutation = useMutation({
    mutationFn: deleteDiscountCode,
    onSuccess: () => {
      void refresh()
      toast.success('کد تخفیف حذف شد')
    },
    onError: (error) => onError(error, 'حذف کد تخفیف ناموفق بود'),
  })

  async function handleDelete(code: DiscountCodeDto) {
    const ok = await confirm({
      title: `حذف کد ${code.code}`,
      description:
        'کدی که در سفارشی استفاده شده باشد حذف نمی‌شود؛ برای توقف آن، کد را غیرفعال کنید.',
      confirmText: 'حذف',
      cancelText: 'انصراف',
      variant: 'danger',
    })
    if (ok) deleteMutation.mutate(code.id)
  }

  const codes = data?.discountCodes ?? []

  return (
    <ScrollReveal className="space-y-6">
      <PageHeader
        title="کدهای تخفیف"
        description="کدهایی که مشتری هنگام خرید وارد می‌کند. تخفیف فقط روی مبلغ کالاها اعمال می‌شود، نه هزینه ارسال."
        action={
          <Button
            onClick={() => {
              setEditing(null)
              setIsOpen(true)
            }}
            className="inline-flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            کد تخفیف جدید
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>لیست کدهای تخفیف</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            caption="کدهای تخفیف فروشگاه"
            rows={codes}
            getRowId={(code) => code.id}
            isLoading={isLoading}
            emptyMessage="هنوز کد تخفیفی تعریف نشده است."
            emptyIcon={<TicketPercent className="h-6 w-6" aria-hidden="true" />}
            columns={[
              {
                id: 'code',
                header: 'کد',
                sortable: true,
                sortValue: (code) => code.code,
                cell: (code) => (
                  <div>
                    <span className="ltr-text font-mono font-medium text-foreground">{code.code}</span>
                    {code.description && (
                      <p className="text-xs text-muted-foreground">{code.description}</p>
                    )}
                  </div>
                ),
              },
              {
                id: 'value',
                header: 'تخفیف',
                cell: (code) => describeValue(code),
              },
              {
                id: 'uses',
                header: 'استفاده (پرداخت‌شده)',
                numeric: true,
                sortable: true,
                sortValue: (code) => code.paidUses,
                cell: (code) =>
                  code.usageLimit === null
                    ? formatNumber(code.paidUses)
                    : `${formatNumber(code.paidUses)} از ${formatNumber(code.usageLimit)}`,
              },
              {
                id: 'given',
                header: 'جمع تخفیف داده‌شده',
                numeric: true,
                hideBelow: 'md',
                sortable: true,
                sortValue: (code) => code.totalDiscountGiven,
                cell: (code) => formatPrice(code.totalDiscountGiven),
              },
              {
                id: 'period',
                header: 'اعتبار',
                hideBelow: 'lg',
                cell: (code) =>
                  code.startsAt || code.expiresAt ? (
                    <span className="text-xs text-muted-foreground">
                      {code.startsAt ? `از ${formatDate(code.startsAt)}` : ''}
                      {code.startsAt && code.expiresAt ? ' ' : ''}
                      {code.expiresAt ? `تا ${formatDate(code.expiresAt)}` : ''}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">بدون محدودیت زمانی</span>
                  ),
              },
              {
                id: 'status',
                header: 'وضعیت',
                align: 'center',
                cell: (code) => {
                  const status = statusOf(code)
                  return <Badge variant={status.variant}>{status.label}</Badge>
                },
              },
              {
                id: 'actions',
                header: 'عملیات',
                align: 'end',
                width: '7rem',
                cell: (code) => (
                  <div className="flex justify-end gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditing(code)
                        setIsOpen(true)
                      }}
                      aria-label={`ویرایش ${code.code}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      loading={deleteMutation.isPending && deleteMutation.variables === code.id}
                      onClick={() => void handleDelete(code)}
                      aria-label={`حذف ${code.code}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ),
              },
            ]}
          />
        </CardContent>
      </Card>

      <Dialog
        open={isOpen}
        onOpenChange={(open) => {
          if (!open) closeDialog()
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? `ویرایش کد ${editing.code}` : 'کد تخفیف جدید'}</DialogTitle>
            <DialogDescription>
              فیلدهای ستاره‌دار الزامی هستند. ویرایش کد، مبلغ سفارش‌های قبلی را تغییر نمی‌دهد.
            </DialogDescription>
          </DialogHeader>
          <DialogForm onSubmit={handleSubmit((values) => saveMutation.mutate(toBody(values)))}>
            <DialogBody className="space-y-4">
              <FormField label="کد" required error={errors.code?.message} hint="حروف انگلیسی، عدد، - یا _">
                {(field) => <Input {...field} dir="ltr" className="font-mono uppercase" {...register('code')} />}
              </FormField>

              <FormField label="توضیح" error={errors.description?.message} hint="فقط برای شما؛ مثلاً «جشنواره یلدا»">
                {(field) => <Input {...field} {...register('description')} />}
              </FormField>

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="نوع تخفیف" required error={errors.type?.message}>
                  {(field) => (
                    <Controller
                      control={control}
                      name="type"
                      render={({ field: select }) => (
                        <Select value={select.value} onValueChange={select.onChange}>
                          <SelectTrigger id={field.id}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="PERCENT">درصدی</SelectItem>
                            <SelectItem value="FIXED">مبلغ ثابت (تومان)</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    />
                  )}
                </FormField>

                <FormField
                  label={type === 'PERCENT' ? 'درصد تخفیف' : 'مبلغ تخفیف (تومان)'}
                  required
                  error={errors.value?.message}
                >
                  {(field) => <Input {...field} inputMode="numeric" dir="ltr" {...register('value')} />}
                </FormField>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {type === 'PERCENT' && (
                  <FormField
                    label="سقف تخفیف (تومان)"
                    error={errors.maxDiscountAmount?.message}
                    hint="خالی یعنی بدون سقف"
                  >
                    {(field) => (
                      <Input {...field} inputMode="numeric" dir="ltr" {...register('maxDiscountAmount')} />
                    )}
                  </FormField>
                )}
                <FormField
                  label="حداقل مبلغ خرید (تومان)"
                  error={errors.minOrderAmount?.message}
                  hint="مبلغ کالاها، بدون هزینه ارسال"
                >
                  {(field) => (
                    <Input {...field} inputMode="numeric" dir="ltr" {...register('minOrderAmount')} />
                  )}
                </FormField>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="تاریخ شروع" error={errors.startsAt?.message} hint="خالی یعنی از همین حالا">
                  {(field) => <Input {...field} type="date" dir="ltr" {...register('startsAt')} />}
                </FormField>
                <FormField label="تاریخ پایان" error={errors.expiresAt?.message} hint="تا پایان همان روز معتبر است">
                  {(field) => <Input {...field} type="date" dir="ltr" {...register('expiresAt')} />}
                </FormField>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="سقف کل استفاده" error={errors.usageLimit?.message} hint="خالی یعنی نامحدود">
                  {(field) => <Input {...field} inputMode="numeric" dir="ltr" {...register('usageLimit')} />}
                </FormField>
                <FormField
                  label="سقف استفاده هر مشتری"
                  error={errors.perUserLimit?.message}
                  hint="خالی یعنی نامحدود"
                >
                  {(field) => <Input {...field} inputMode="numeric" dir="ltr" {...register('perUserLimit')} />}
                </FormField>
              </div>

              <Controller
                control={control}
                name="isActive"
                render={({ field }) => (
                  <label className="flex cursor-pointer items-center justify-between">
                    <span className="text-sm font-medium text-foreground">فعال</span>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </label>
                )}
              />
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog}>
                انصراف
              </Button>
              <Button type="submit" loading={saveMutation.isPending}>
                ذخیره
              </Button>
            </DialogFooter>
          </DialogForm>
        </DialogContent>
      </Dialog>

      <ConfirmDialogComponent />
    </ScrollReveal>
  )
}
