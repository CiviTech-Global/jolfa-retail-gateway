import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Input'
import { Switch } from '@/components/ui/Switch'
import { FormError, FormField } from '@/components/ui/FormField'
import { ImageUploader } from '@/components/ui/ImageUploader'
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select'
import { ApiError } from '@/api/errors'
import {
  clearable,
  numericField,
  optionalSlugSchema,
  optionalText,
  requiredText,
  requiredUuid,
} from '@/lib/validation'
import { createProduct, getCategories, getProductBySlug, updateProduct } from '@/features/catalog/api'
import type { CategoryDto, ProductCreateBody, ProductDto } from '@/features/catalog/types'

const productSchema = z
  .object({
    title: requiredText('عنوان محصول', 200),
    slug: optionalSlugSchema,
    description: optionalText('توضیحات', 10000),
    shortDescription: optionalText('توضیحات کوتاه', 500),
    price: numericField('قیمت', { min: 1 }),
    compareAtPrice: numericField('قیمت قبل از تخفیف', { required: false, min: 1 }),
    stockQuantity: numericField('موجودی', { min: 0 }),
    weightGrams: numericField('وزن', { required: false, min: 1 }),
    sku: optionalText('کد کالا', 100),
    categoryId: requiredUuid('دسته‌بندی'),
    isActive: z.boolean(),
    isFeatured: z.boolean(),
    metaTitle: optionalText('عنوان متا', 200),
    metaDescription: optionalText('توضیحات متا', 500),
    images: z
      .array(
        z.object({
          url: z.string(),
          altText: z.string().optional(),
          sortOrder: z.number().optional(),
          isPrimary: z.boolean().optional(),
        }),
      )
      .max(10, 'حداکثر ۱۰ تصویر مجاز است'),
  })
  // A discount price that is not above the price is a data error the server
  // cannot catch: both values are individually valid.
  .refine(
    (data) =>
      data.compareAtPrice === undefined ||
      data.price === undefined ||
      data.compareAtPrice > data.price,
    { path: ['compareAtPrice'], message: 'قیمت قبل از تخفیف باید بیشتر از قیمت فعلی باشد' },
  )

type ProductFormValues = z.input<typeof productSchema>
type ProductFormOutput = z.output<typeof productSchema>

/** Field names the form actually renders, for mapping server errors back. */
const FORM_FIELDS: Record<keyof ProductFormValues, true> = {
  title: true,
  slug: true,
  description: true,
  shortDescription: true,
  price: true,
  compareAtPrice: true,
  stockQuantity: true,
  weightGrams: true,
  sku: true,
  categoryId: true,
  isActive: true,
  isFeatured: true,
  metaTitle: true,
  metaDescription: true,
  images: true,
}

function emptyValues(): ProductFormValues {
  return {
    title: '',
    slug: '',
    description: '',
    shortDescription: '',
    price: '',
    compareAtPrice: '',
    stockQuantity: '0',
    weightGrams: '',
    sku: '',
    categoryId: '',
    isActive: true,
    isFeatured: false,
    metaTitle: '',
    metaDescription: '',
    images: [],
  }
}

function productToValues(product: ProductDto): ProductFormValues {
  return {
    title: product.title,
    slug: product.slug,
    description: product.description ?? '',
    shortDescription: product.shortDescription ?? '',
    price: String(product.price),
    compareAtPrice: product.compareAtPrice ? String(product.compareAtPrice) : '',
    stockQuantity: String(product.stockQuantity),
    weightGrams: product.weightGrams ? String(product.weightGrams) : '',
    sku: product.sku ?? '',
    categoryId: product.categoryId,
    isActive: product.isActive,
    isFeatured: product.isFeatured,
    metaTitle: product.metaTitle ?? '',
    metaDescription: product.metaDescription ?? '',
    images: product.images.map((img) => ({
      url: img.url,
      altText: img.altText ?? '',
      sortOrder: img.sortOrder,
      isPrimary: img.isPrimary,
    })),
  }
}

function toBody(data: ProductFormOutput): ProductCreateBody {
  return {
    title: data.title,
    slug: data.slug,
    // `null` clears a nullable column; `undefined` would leave it unchanged.
    description: clearable(data.description),
    shortDescription: clearable(data.shortDescription),
    price: data.price as number,
    compareAtPrice: clearable(data.compareAtPrice),
    stockQuantity: data.stockQuantity as number,
    weightGrams: clearable(data.weightGrams),
    sku: clearable(data.sku),
    categoryId: data.categoryId,
    isActive: data.isActive,
    isFeatured: data.isFeatured,
    metaTitle: clearable(data.metaTitle),
    metaDescription: clearable(data.metaDescription),
    images: data.images.map((img, index) => ({
      url: img.url,
      altText: img.altText || data.title,
      sortOrder: img.sortOrder ?? index,
      isPrimary: img.isPrimary ?? index === 0,
    })),
  }
}

/** Groups fields without the visual weight of a Card inside a dialog. */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <h3 className="border-b border-border/60 pb-2 text-sm font-semibold text-foreground">
        {title}
      </h3>
      {children}
    </section>
  )
}

interface ProductFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Absent when creating; the product's slug when editing. */
  slug?: string
}

export function ProductFormDialog({ open, onOpenChange, slug }: ProductFormDialogProps) {
  const isEdit = Boolean(slug)

  const { data: categoriesData } = useQuery({
    queryKey: ['categories'],
    queryFn: () => getCategories(false),
    enabled: open,
  })

  const { data: productData, isLoading } = useQuery({
    queryKey: ['products', slug],
    queryFn: () => getProductBySlug(slug!),
    enabled: open && isEdit,
  })

  const categories = (categoriesData?.categories ?? []) as CategoryDto[]
  const product = productData?.product

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'ویرایش محصول' : 'محصول جدید'}</DialogTitle>
          <DialogDescription>
            فیلدهای ستاره‌دار الزامی هستند؛ بقیه را می‌توانید خالی بگذارید.
          </DialogDescription>
        </DialogHeader>

        {isEdit && isLoading ? (
          <DialogBody>
            <p className="py-12 text-center text-muted-foreground">در حال بارگذاری ...</p>
          </DialogBody>
        ) : (
          // Remounting per product resets the form to the right defaults; the
          // dialog itself stays mounted between openings.
          <ProductEditor
            key={slug ?? 'new'}
            slug={slug}
            initialProduct={product}
            categories={categories}
            onDone={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

interface ProductEditorProps {
  slug?: string
  initialProduct?: ProductDto
  categories: CategoryDto[]
  onDone: () => void
}

function ProductEditor({ slug, initialProduct, categories, onDone }: ProductEditorProps) {
  const queryClient = useQueryClient()
  const isEdit = Boolean(slug)

  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ProductFormValues, unknown, ProductFormOutput>({
    resolver: zodResolver(productSchema),
    defaultValues: initialProduct ? productToValues(initialProduct) : emptyValues(),
    mode: 'onBlur',
    reValidateMode: 'onChange',
  })

  // useWatch keeps this subscription memoization-safe for the React Compiler;
  // watch() returns a fresh function each render and opts the file out.
  const title = useWatch({ control, name: 'title' })

  const onSuccess = () => {
    void queryClient.invalidateQueries({ queryKey: ['admin', 'products'] })
    void queryClient.invalidateQueries({ queryKey: ['products'] })
    toast.success(isEdit ? 'محصول به‌روزرسانی شد' : 'محصول ایجاد شد')
    onDone()
  }

  /** Maps server-side field errors back onto the matching inputs. */
  const onError = (error: unknown) => {
    let matchedField = false
    if (error instanceof ApiError && error.fieldErrors) {
      for (const [field, messages] of Object.entries(error.fieldErrors)) {
        // Server paths for nested values look like "images.0.url"; anchor on
        // the root field so the message lands on a control that exists.
        const root = field.split('.')[0]
        if (root in FORM_FIELDS && messages[0]) {
          setError(root as keyof ProductFormValues, { type: 'server', message: messages[0] })
          matchedField = true
        }
      }
    }
    if (!matchedField) {
      toast.error(error instanceof Error ? error.message : 'ذخیره محصول ناموفق بود')
    }
  }

  const createMutation = useMutation({ mutationFn: createProduct, onSuccess, onError })
  const updateMutation = useMutation({
    mutationFn: (body: ProductCreateBody) => updateProduct(slug!, body),
    onSuccess,
    onError,
  })

  const submit = (data: ProductFormOutput) => {
    const body = toBody(data)
    if (isEdit) {
      updateMutation.mutate(body)
    } else {
      createMutation.mutate(body)
    }
  }

  const isPending = isSubmitting || createMutation.isPending || updateMutation.isPending

  return (
    <DialogForm onSubmit={handleSubmit(submit)}>
      <DialogBody className="space-y-6">
        <Section title="اطلاعات اصلی">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="عنوان" required error={errors.title?.message} className="sm:col-span-2">
              {(field) => <Input {...field} {...register('title')} />}
            </FormField>

            <FormField
              label="اسلاگ"
              error={errors.slug?.message}
              hint="خالی بگذارید تا به‌صورت خودکار ساخته شود"
            >
              {(field) => <Input {...field} dir="ltr" placeholder="my-product" {...register('slug')} />}
            </FormField>

            <FormField label="دسته‌بندی" required error={errors.categoryId?.message}>
              {(field) => (
                <Controller
                  control={control}
                  name="categoryId"
                  render={({ field: select }) => (
                    <Select value={select.value} onValueChange={select.onChange}>
                      <SelectTrigger id={field.id} aria-invalid={field['aria-invalid']}>
                        <SelectValue placeholder="انتخاب دسته‌بندی" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((cat) => (
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

            <FormField label="قیمت (تومان)" required error={errors.price?.message}>
              {(field) => <Input {...field} inputMode="numeric" dir="ltr" {...register('price')} />}
            </FormField>

            <FormField label="قیمت قبل از تخفیف" error={errors.compareAtPrice?.message}>
              {(field) => (
                <Input {...field} inputMode="numeric" dir="ltr" {...register('compareAtPrice')} />
              )}
            </FormField>

            <FormField label="موجودی" required error={errors.stockQuantity?.message}>
              {(field) => (
                <Input {...field} inputMode="numeric" dir="ltr" {...register('stockQuantity')} />
              )}
            </FormField>

            <FormField label="وزن (گرم)" error={errors.weightGrams?.message}>
              {(field) => (
                <Input {...field} inputMode="numeric" dir="ltr" {...register('weightGrams')} />
              )}
            </FormField>

            <FormField label="کد کالا (SKU)" error={errors.sku?.message}>
              {(field) => <Input {...field} dir="ltr" {...register('sku')} />}
            </FormField>

            <div className="flex items-center gap-6 sm:col-span-2">
              <Controller
                control={control}
                name="isActive"
                render={({ field }) => (
                  <label className="flex cursor-pointer items-center gap-2">
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                    <span className="text-sm text-foreground">فعال</span>
                  </label>
                )}
              />
              <Controller
                control={control}
                name="isFeatured"
                render={({ field }) => (
                  <label className="flex cursor-pointer items-center gap-2">
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                    <span className="text-sm text-foreground">ویژه</span>
                  </label>
                )}
              />
            </div>
          </div>
        </Section>

        <Section title="توضیحات">
          <div className="grid gap-4">
            <FormField label="توضیحات کوتاه" error={errors.shortDescription?.message}>
              {(field) => <Input {...field} {...register('shortDescription')} />}
            </FormField>
            <FormField label="توضیحات" error={errors.description?.message}>
              {(field) => <Textarea {...field} rows={5} {...register('description')} />}
            </FormField>
          </div>
        </Section>

        <Section title="تصاویر">
          <Controller
            control={control}
            name="images"
            render={({ field }) => (
              <ImageUploader
                value={field.value}
                onChange={field.onChange}
                altTextFallback={title}
                error={errors.images?.message}
              />
            )}
          />
          {errors.images?.message && <FormError message={errors.images.message} />}
        </Section>

        <Section title="SEO">
          <div className="grid gap-4">
            <FormField label="Meta Title" error={errors.metaTitle?.message}>
              {(field) => <Input {...field} {...register('metaTitle')} />}
            </FormField>
            <FormField label="Meta Description" error={errors.metaDescription?.message}>
              {(field) => <Textarea {...field} rows={3} {...register('metaDescription')} />}
            </FormField>
          </div>
        </Section>
      </DialogBody>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone} disabled={isPending}>
          انصراف
        </Button>
        <Button type="submit" loading={isPending}>
          ذخیره محصول
        </Button>
      </DialogFooter>
    </DialogForm>
  )
}
