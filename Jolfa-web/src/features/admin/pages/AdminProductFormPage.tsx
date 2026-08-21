import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, Plus, Trash2, Star } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Switch } from '@/components/ui/Switch'
import { Badge } from '@/components/ui/Badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { ScrollReveal } from '@/components/motion/ScrollReveal'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select'
import { createProduct, getCategories, getProductBySlug, updateProduct } from '@/features/catalog/api'
import { uploadFile } from '@/features/uploads/api'
import type { CategoryDto, ProductCreateBody, ProductDto, ProductImageInput } from '@/features/catalog/types'

interface ProductFormData {
  title: string
  slug: string
  description: string
  shortDescription: string
  price: string
  compareAtPrice: string
  stockQuantity: string
  weightGrams: string
  sku: string
  categoryId: string
  isActive: boolean
  isFeatured: boolean
  metaTitle: string
  metaDescription: string
  images: ProductImageInput[]
}

function emptyForm(): ProductFormData {
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

function productToForm(product: ProductDto): ProductFormData {
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

function formToBody(data: ProductFormData): ProductCreateBody {
  return {
    title: data.title,
    slug: data.slug || undefined,
    description: data.description || undefined,
    shortDescription: data.shortDescription || undefined,
    price: Number(data.price),
    compareAtPrice: data.compareAtPrice ? Number(data.compareAtPrice) : null,
    stockQuantity: Number(data.stockQuantity),
    weightGrams: data.weightGrams ? Number(data.weightGrams) : null,
    sku: data.sku || null,
    categoryId: data.categoryId,
    isActive: data.isActive,
    isFeatured: data.isFeatured,
    metaTitle: data.metaTitle || null,
    metaDescription: data.metaDescription || null,
    images: data.images.map((img, index) => ({
      url: img.url,
      altText: img.altText ?? data.title,
      sortOrder: img.sortOrder ?? index,
      isPrimary: img.isPrimary ?? index === 0,
    })),
  }
}

export function AdminProductFormPage() {
  const { slug } = useParams<{ slug?: string }>()
  const isEdit = Boolean(slug)

  const { data: categoriesData } = useQuery({
    queryKey: ['categories'],
    queryFn: () => getCategories(false),
  })

  const { data: productData, isLoading } = useQuery({
    queryKey: ['products', slug],
    queryFn: () => getProductBySlug(slug!),
    enabled: isEdit,
  })

  if (isEdit && isLoading) {
    return <div className="py-12 text-center text-muted-foreground">در حال بارگذاری ...</div>
  }

  return (
    <ProductEditor
      key={slug ?? 'new'}
      isEdit={isEdit}
      initialProduct={productData?.product}
      categories={(categoriesData?.categories ?? []) as CategoryDto[]}
      slug={slug}
    />
  )
}

interface ProductEditorProps {
  isEdit: boolean
  initialProduct?: ProductDto
  categories: CategoryDto[]
  slug?: string
}

function ProductEditor({ isEdit, initialProduct, categories, slug }: ProductEditorProps) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [form, setForm] = useState<ProductFormData>(() =>
    initialProduct ? productToForm(initialProduct) : emptyForm()
  )
  const [uploading, setUploading] = useState(false)

  const createMutation = useMutation({
    mutationFn: createProduct,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['products'] })
      navigate('/admin/products')
    },
  })

  const updateMutation = useMutation({
    mutationFn: (body: ProductCreateBody) => updateProduct(slug!, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['products'] })
      navigate('/admin/products')
    },
  })

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const url = await uploadFile(file)
      setForm((prev) => ({
        ...prev,
        images: [
          ...prev.images,
          { url, altText: prev.title, sortOrder: prev.images.length, isPrimary: prev.images.length === 0 },
        ],
      }))
    } finally {
      setUploading(false)
    }
  }

  const removeImage = (index: number) => {
    setForm((prev) => {
      const images = prev.images.filter((_, i) => i !== index)
      if (images.length > 0 && !images.some((img) => img.isPrimary)) {
        images[0].isPrimary = true
      }
      return { ...prev, images }
    })
  }

  const setPrimary = (index: number) => {
    setForm((prev) => ({
      ...prev,
      images: prev.images.map((img, i) => ({ ...img, isPrimary: i === index })),
    }))
  }

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    const body = formToBody(form)
    if (isEdit) {
      updateMutation.mutate(body)
    } else {
      createMutation.mutate(body)
    }
  }

  return (
    <ScrollReveal className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground md:text-3xl">{isEdit ? 'ویرایش محصول' : 'محصول جدید'}</h1>
        <p className="mt-2 text-muted-foreground">اطلاعات محصول را وارد کنید.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>اطلاعات اصلی</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium text-foreground">عنوان</label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">اسلاگ</label>
              <Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="اختیاری" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">دسته‌بندی</label>
              <Select value={form.categoryId} onValueChange={(value) => setForm({ ...form, categoryId: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="انتخاب دسته‌بندی" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">قیمت</label>
              <Input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} required />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">قیمت قبل از تخفیف</label>
              <Input type="number" value={form.compareAtPrice} onChange={(e) => setForm({ ...form, compareAtPrice: e.target.value })} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">موجودی</label>
              <Input type="number" value={form.stockQuantity} onChange={(e) => setForm({ ...form, stockQuantity: e.target.value })} required />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">وزن (گرم)</label>
              <Input type="number" value={form.weightGrams} onChange={(e) => setForm({ ...form, weightGrams: e.target.value })} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">SKU</label>
              <Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Switch checked={form.isActive} onCheckedChange={(checked) => setForm({ ...form, isActive: checked })} />
                <span className="text-sm text-foreground">فعال</span>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={form.isFeatured} onCheckedChange={(checked) => setForm({ ...form, isFeatured: checked })} />
                <span className="text-sm text-foreground">ویژه</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>توضیحات</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">توضیحات کوتاه</label>
              <Input value={form.shortDescription} onChange={(e) => setForm({ ...form, shortDescription: e.target.value })} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">توضیحات</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={5}
                className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/20"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>تصاویر</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-4">
              {form.images.map((image, index) => (
                <div key={index} className="relative w-24 rounded-xl border border-border bg-surface p-1">
                  <img
                    src={image.url}
                    alt={image.altText || `تصویر شماره ${index + 1} محصول`}
                    className="aspect-square w-full rounded-lg object-cover"
                  />
                  {image.isPrimary && <Badge variant="warning" className="absolute top-1 start-1 text-[10px]">اصلی</Badge>}
                  <div className="absolute bottom-1 start-1 flex gap-1">
                    <button type="button" onClick={() => setPrimary(index)} className="rounded bg-primary p-1 text-white">
                      <Star className="h-3 w-3" />
                    </button>
                    <button type="button" onClick={() => removeImage(index)} className="rounded bg-danger p-1 text-white">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              ))}
              <label className="flex h-24 w-24 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-border bg-surface text-muted-foreground hover:bg-muted">
                {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus className="h-5 w-5" />}
                <span className="mt-1 text-xs">آپلود</span>
                <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
              </label>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>SEO</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium text-foreground">Meta Title</label>
              <Input value={form.metaTitle} onChange={(e) => setForm({ ...form, metaTitle: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium text-foreground">Meta Description</label>
              <Input value={form.metaDescription} onChange={(e) => setForm({ ...form, metaDescription: e.target.value })} />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => navigate('/admin/products')}>انصراف</Button>
          <Button type="submit" loading={createMutation.isPending || updateMutation.isPending}>ذخیره محصول</Button>
        </div>
      </form>
    </ScrollReveal>
  )
}
