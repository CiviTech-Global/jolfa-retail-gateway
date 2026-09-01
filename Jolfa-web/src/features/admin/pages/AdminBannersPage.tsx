import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Switch } from '@/components/ui/Switch'
import { Badge } from '@/components/ui/Badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogForm, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/Dialog'
import { FormField } from '@/components/ui/FormField'
import { ImageUploader } from '@/components/ui/ImageUploader'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select'
import { ScrollReveal } from '@/components/motion/ScrollReveal'
import { useConfirmDialog } from '@/hooks/useConfirmDialog'
import { ApiError } from '@/api/errors'
import { clearable, numericField, requiredImageUrlSchema, optionalText, requiredText } from '@/lib/validation'
import { getAdminBanners, createBanner, updateBanner, deleteBanner } from '@/features/cms/api'
import type { BannerDto, BannerCreateBody, BannerUpdateBody } from '@/features/cms/types'

/** Mirrors BANNER_POSITIONS on the server. */
const POSITIONS = [
  { value: 'hero', label: 'اسلایدر اصلی' },
  { value: 'sidebar', label: 'ستون کناری' },
  { value: 'footer', label: 'پاورقی' },
  { value: 'promo', label: 'تبلیغاتی' },
] as const

const bannerSchema = z.object({
  title: requiredText('عنوان بنر', 200),
  subtitle: optionalText('زیرعنوان', 500),
  imageUrl: requiredImageUrlSchema,
  link: z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
    z
      .string()
      .trim()
      .max(500, 'لینک حداکثر ۵۰۰ کاراکتر است')
      .refine(
        (value) => value.startsWith('/') || /^https?:\/\//i.test(value),
        'لینک باید با / یا http شروع شود',
      )
      .optional(),
  ),
  position: z.enum(['hero', 'sidebar', 'footer', 'promo'], {
    errorMap: () => ({ message: 'موقعیت انتخاب‌شده معتبر نیست' }),
  }),
  displayOrder: numericField('ترتیب نمایش', { min: 0 }),
  isActive: z.boolean(),
})

type BannerFormValues = z.input<typeof bannerSchema>
type BannerFormOutput = z.output<typeof bannerSchema>

function emptyValues(): BannerFormValues {
  return {
    title: '',
    subtitle: '',
    imageUrl: '',
    link: '',
    position: 'hero',
    displayOrder: '0',
    isActive: true,
  }
}

function bannerToValues(banner: BannerDto): BannerFormValues {
  return {
    title: banner.title,
    subtitle: banner.subtitle ?? '',
    imageUrl: banner.imageUrl,
    link: banner.link ?? '',
    position: (POSITIONS.some((p) => p.value === banner.position)
      ? banner.position
      : 'hero') as BannerFormValues['position'],
    displayOrder: String(banner.displayOrder),
    isActive: banner.isActive,
  }
}

function toBody(data: BannerFormOutput): BannerCreateBody {
  return {
    title: data.title,
    subtitle: clearable(data.subtitle),
    imageUrl: data.imageUrl,
    link: clearable(data.link),
    position: data.position,
    displayOrder: data.displayOrder as number,
    isActive: data.isActive,
  }
}

export function AdminBannersPage() {
  const queryClient = useQueryClient()
  const { confirm, Dialog: ConfirmDialogComponent } = useConfirmDialog()
  const [isOpen, setIsOpen] = useState(false)
  const [editing, setEditing] = useState<BannerDto | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'banners'],
    queryFn: getAdminBanners,
  })

  const {
    register,
    handleSubmit,
    control,
    reset,
    setError,
    formState: { errors },
  } = useForm<BannerFormValues, unknown, BannerFormOutput>({
    resolver: zodResolver(bannerSchema),
    defaultValues: emptyValues(),
    mode: 'onBlur',
    reValidateMode: 'onChange',
  })

  useEffect(() => {
    if (isOpen) {
      reset(editing ? bannerToValues(editing) : emptyValues())
    }
  }, [isOpen, editing, reset])

  const onError = (error: unknown, fallback: string) => {
    if (error instanceof ApiError && error.fieldErrors) {
      let matched = false
      for (const [field, messages] of Object.entries(error.fieldErrors)) {
        const root = field.split('.')[0] as keyof BannerFormValues
        if (root in emptyValues() && messages[0]) {
          setError(root, { type: 'server', message: messages[0] })
          matched = true
        }
      }
      if (matched) return
    }
    toast.error(error instanceof Error ? error.message : fallback)
  }

  const closeDialog = () => {
    setIsOpen(false)
    setEditing(null)
  }

  const createMutation = useMutation({
    mutationFn: createBanner,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'banners'] })
      closeDialog()
      toast.success('بنر ایجاد شد')
    },
    onError: (error) => onError(error, 'ایجاد بنر ناموفق بود'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: BannerUpdateBody }) => updateBanner(id, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'banners'] })
      closeDialog()
      toast.success('بنر به‌روزرسانی شد')
    },
    onError: (error) => onError(error, 'به‌روزرسانی بنر ناموفق بود'),
  })

  const deleteMutation = useMutation({
    mutationFn: deleteBanner,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'banners'] })
      toast.success('بنر حذف شد')
    },
    onError: (error) => onError(error, 'حذف بنر ناموفق بود'),
  })

  const submit = (data: BannerFormOutput) => {
    if (editing) {
      updateMutation.mutate({ id: editing.id, body: toBody(data) })
    } else {
      createMutation.mutate(toBody(data))
    }
  }

  async function handleDelete(id: string) {
    const ok = await confirm({
      title: 'حذف بنر',
      description: 'آیا مطمئنید؟ این عملیات قابل بازگشت نیست.',
      confirmText: 'حذف',
      cancelText: 'انصراف',
      variant: 'danger',
    })
    if (ok) deleteMutation.mutate(id)
  }

  const banners = data?.banners ?? []

  return (
    <ScrollReveal className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground md:text-3xl">مدیریت بنرها</h1>
          <p className="mt-2 text-muted-foreground">بنرهای صفحه اصلی را مدیریت کنید.</p>
        </div>
        <Button
          onClick={() => {
            setEditing(null)
            setIsOpen(true)
          }}
          className="inline-flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          بنر جدید
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>لیست بنرها</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">عنوان</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">موقعیت</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">وضعیت</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">ترتیب</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">عملیات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isLoading ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">در حال بارگذاری ...</td>
                  </tr>
                ) : banners.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">بنری یافت نشد.</td>
                  </tr>
                ) : (
                  banners.map((banner) => (
                    <tr key={banner.id}>
                      <td className="px-4 py-3 font-medium text-foreground">{banner.title}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {POSITIONS.find((p) => p.value === banner.position)?.label ?? banner.position}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={banner.isActive ? 'success' : 'danger'}>
                          {banner.isActive ? 'فعال' : 'غیرفعال'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-foreground">{banner.displayOrder}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditing(banner)
                              setIsOpen(true)
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                            <span className="sr-only">ویرایش</span>
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            loading={deleteMutation.isPending}
                            onClick={() => handleDelete(banner.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                            <span className="sr-only">حذف</span>
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
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
            <DialogTitle>{editing ? 'ویرایش بنر' : 'بنر جدید'}</DialogTitle>
            <DialogDescription>فیلدهای ستاره‌دار الزامی هستند.</DialogDescription>
          </DialogHeader>
          <DialogForm onSubmit={handleSubmit(submit)}>
            <DialogBody className="space-y-4">
            <FormField label="عنوان" required error={errors.title?.message}>
              {(field) => <Input {...field} {...register('title')} />}
            </FormField>

            <FormField label="زیرعنوان" error={errors.subtitle?.message}>
              {(field) => <Input {...field} {...register('subtitle')} />}
            </FormField>

            {/* Uploading beats pasting a URL; the field still accepts one. */}
            <Controller
              control={control}
              name="imageUrl"
              render={({ field }) => (
                <div>
                  <span className="mb-1 flex items-center gap-1 text-sm font-medium text-foreground">
                    تصویر بنر
                    <span className="text-danger" aria-hidden="true">
                      *
                    </span>
                  </span>
                  <ImageUploader
                    value={field.value ? [{ url: field.value, isPrimary: true }] : []}
                    onChange={(images) => field.onChange(images[0]?.url ?? '')}
                    maxFiles={1}
                    error={errors.imageUrl?.message}
                    altTextFallback="بنر"
                  />
                  {errors.imageUrl?.message && (
                    <p role="alert" className="mt-1 text-sm text-danger">
                      {errors.imageUrl.message}
                    </p>
                  )}
                </div>
              )}
            />

            <FormField label="لینک" error={errors.link?.message} hint="مانند /products یا https://...">
              {(field) => <Input {...field} dir="ltr" {...register('link')} />}
            </FormField>

            <FormField label="موقعیت" required error={errors.position?.message}>
              {(field) => (
                <Controller
                  control={control}
                  name="position"
                  render={({ field: select }) => (
                    <Select value={select.value} onValueChange={select.onChange}>
                      <SelectTrigger id={field.id} aria-invalid={field['aria-invalid']}>
                        <SelectValue placeholder="انتخاب موقعیت" />
                      </SelectTrigger>
                      <SelectContent>
                        {POSITIONS.map((position) => (
                          <SelectItem key={position.value} value={position.value}>
                            {position.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              )}
            </FormField>

            <FormField label="ترتیب نمایش" required error={errors.displayOrder?.message}>
              {(field) => <Input {...field} inputMode="numeric" dir="ltr" {...register('displayOrder')} />}
            </FormField>

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
              <Button type="submit" loading={createMutation.isPending || updateMutation.isPending}>
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
