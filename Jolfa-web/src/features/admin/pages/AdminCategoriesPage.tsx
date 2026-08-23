import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Input'
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
import {
  clearable,
  numericField,
  optionalImageUrlSchema,
  optionalSlugSchema,
  optionalText,
  requiredText,
} from '@/lib/validation'
import { getCategories, createCategory, updateCategory, deleteCategory } from '@/features/catalog/api'
import type { CategoryDto, CategoryCreateBody, CategoryUpdateBody } from '@/features/catalog/types'

const NO_PARENT = '__none__'

const categorySchema = z.object({
  name: requiredText('نام دسته‌بندی', 100),
  slug: optionalSlugSchema,
  description: optionalText('توضیحات', 1000),
  imageUrl: optionalImageUrlSchema,
  parentId: z.string().optional(),
  displayOrder: numericField('ترتیب نمایش', { min: 0 }),
  isActive: z.boolean(),
})

type CategoryFormValues = z.input<typeof categorySchema>
type CategoryFormOutput = z.output<typeof categorySchema>

function emptyValues(): CategoryFormValues {
  return {
    name: '',
    slug: '',
    description: '',
    imageUrl: '',
    parentId: NO_PARENT,
    displayOrder: '0',
    isActive: true,
  }
}

function categoryToValues(category: CategoryDto): CategoryFormValues {
  return {
    name: category.name,
    slug: category.slug,
    description: category.description ?? '',
    imageUrl: category.imageUrl ?? '',
    parentId: category.parentId ?? NO_PARENT,
    displayOrder: String(category.displayOrder),
    isActive: category.isActive,
  }
}

function toBody(data: CategoryFormOutput): CategoryCreateBody {
  return {
    name: data.name,
    slug: data.slug,
    description: clearable(data.description),
    imageUrl: clearable(data.imageUrl),
    parentId: data.parentId && data.parentId !== NO_PARENT ? data.parentId : null,
    displayOrder: data.displayOrder as number,
    isActive: data.isActive,
  }
}

export function AdminCategoriesPage() {
  const queryClient = useQueryClient()
  const { confirm, Dialog: ConfirmDialogComponent } = useConfirmDialog()
  const [isOpen, setIsOpen] = useState(false)
  const [editing, setEditing] = useState<CategoryDto | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['categories'],
    queryFn: () => getCategories(false),
  })

  const {
    register,
    handleSubmit,
    control,
    reset,
    setError,
    formState: { errors },
  } = useForm<CategoryFormValues, unknown, CategoryFormOutput>({
    resolver: zodResolver(categorySchema),
    defaultValues: emptyValues(),
    mode: 'onBlur',
    reValidateMode: 'onChange',
  })

  // Reset when the dialog target changes, so a previous edit's values and
  // errors never leak into the next open.
  useEffect(() => {
    if (isOpen) {
      reset(editing ? categoryToValues(editing) : emptyValues())
    }
  }, [isOpen, editing, reset])

  const onError = (error: unknown, fallback: string) => {
    if (error instanceof ApiError && error.fieldErrors) {
      let matched = false
      for (const [field, messages] of Object.entries(error.fieldErrors)) {
        const root = field.split('.')[0] as keyof CategoryFormValues
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
    mutationFn: createCategory,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['categories'] })
      closeDialog()
      toast.success('دسته‌بندی ایجاد شد')
    },
    onError: (error) => onError(error, 'ایجاد دسته‌بندی ناموفق بود'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ slug, body }: { slug: string; body: CategoryUpdateBody }) => updateCategory(slug, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['categories'] })
      closeDialog()
      toast.success('دسته‌بندی به‌روزرسانی شد')
    },
    onError: (error) => onError(error, 'به‌روزرسانی دسته‌بندی ناموفق بود'),
  })

  const deleteMutation = useMutation({
    mutationFn: deleteCategory,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['categories'] })
      toast.success('دسته‌بندی حذف شد')
    },
    onError: (error) => onError(error, 'حذف دسته‌بندی ناموفق بود'),
  })

  const openCreate = () => {
    setEditing(null)
    setIsOpen(true)
  }

  const openEdit = (category: CategoryDto) => {
    setEditing(category)
    setIsOpen(true)
  }

  const submit = (data: CategoryFormOutput) => {
    if (editing) {
      updateMutation.mutate({ slug: editing.slug, body: toBody(data) })
    } else {
      createMutation.mutate(toBody(data))
    }
  }

  async function handleDelete(slug: string) {
    const ok = await confirm({
      title: 'حذف دسته‌بندی',
      description: 'آیا مطمئنید؟ این عملیات قابل بازگشت نیست.',
      confirmText: 'حذف',
      cancelText: 'انصراف',
      variant: 'danger',
    })
    if (ok) deleteMutation.mutate(slug)
  }

  const categories = (data?.categories as CategoryDto[]) ?? []
  // A category cannot be its own parent, nor can the list offer a cycle.
  const parentOptions = categories.filter((cat) => cat.id !== editing?.id)

  return (
    <ScrollReveal className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground md:text-3xl">مدیریت دسته‌بندی‌ها</h1>
          <p className="mt-2 text-muted-foreground">دسته‌بندی‌ها را ایجاد، ویرایش یا حذف کنید.</p>
        </div>
        <Button onClick={openCreate} className="inline-flex items-center gap-2">
          <Plus className="h-4 w-4" />
          دسته‌بندی جدید
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>لیست دسته‌بندی‌ها</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">نام</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">اسلاگ</th>
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
                ) : categories.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">دسته‌بندی یافت نشد.</td>
                  </tr>
                ) : (
                  categories.map((category) => (
                    <tr key={category.id}>
                      <td className="px-4 py-3 font-medium text-foreground">{category.name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{category.slug}</td>
                      <td className="px-4 py-3">
                        <Badge variant={category.isActive ? 'success' : 'danger'}>
                          {category.isActive ? 'فعال' : 'غیرفعال'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-foreground">{category.displayOrder}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" variant="outline" onClick={() => openEdit(category)}>
                            <Pencil className="h-4 w-4" />
                            <span className="sr-only">ویرایش</span>
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            loading={deleteMutation.isPending}
                            onClick={() => handleDelete(category.slug)}
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
            <DialogTitle>{editing ? 'ویرایش دسته‌بندی' : 'دسته‌بندی جدید'}</DialogTitle>
            <DialogDescription>فیلدهای ستاره‌دار الزامی هستند.</DialogDescription>
          </DialogHeader>
          <DialogForm onSubmit={handleSubmit(submit)}>
            <DialogBody className="space-y-4">
            <FormField label="نام" required error={errors.name?.message}>
              {(field) => <Input {...field} {...register('name')} />}
            </FormField>

            <FormField
              label="اسلاگ"
              error={errors.slug?.message}
              hint="خالی بگذارید تا به‌صورت خودکار ساخته شود"
            >
              {(field) => <Input {...field} dir="ltr" {...register('slug')} />}
            </FormField>

            <FormField label="توضیحات" error={errors.description?.message}>
              {(field) => <Textarea {...field} {...register('description')} />}
            </FormField>

            {/* Was a bare URL text box with no way to actually upload a file. */}
            <Controller
              control={control}
              name="imageUrl"
              render={({ field }) => {
                // The schema preprocesses, so the field's input type is `unknown`.
                const url = typeof field.value === 'string' ? field.value : ''
                return (
                <div>
                  <span className="mb-1 block text-sm font-medium text-foreground">
                    تصویر دسته‌بندی
                    <span className="ms-1 text-xs font-normal text-muted-foreground">(اختیاری)</span>
                  </span>
                  <ImageUploader
                    value={url ? [{ url, isPrimary: true }] : []}
                    onChange={(images) => field.onChange(images[0]?.url ?? '')}
                    maxFiles={1}
                    error={errors.imageUrl?.message}
                    altTextFallback="دسته‌بندی"
                  />
                  {errors.imageUrl?.message && (
                    <p role="alert" className="mt-1 text-sm text-danger">
                      {errors.imageUrl.message}
                    </p>
                  )}
                </div>
                )
              }}
            />

            <FormField label="دسته‌بندی والد" error={errors.parentId?.message}>
              {(field) => (
                <Controller
                  control={control}
                  name="parentId"
                  render={({ field: select }) => (
                    <Select value={select.value ?? NO_PARENT} onValueChange={select.onChange}>
                      <SelectTrigger id={field.id} aria-invalid={field['aria-invalid']}>
                        <SelectValue placeholder="بدون والد" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NO_PARENT}>بدون والد</SelectItem>
                        {parentOptions.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id}>
                            {cat.name}
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
