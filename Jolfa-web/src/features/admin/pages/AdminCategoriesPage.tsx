import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Switch } from '@/components/ui/Switch'
import { Badge } from '@/components/ui/Badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/Dialog'
import { ScrollReveal } from '@/components/motion/ScrollReveal'
import { useConfirmDialog } from '@/hooks/useConfirmDialog'
import { getCategories, createCategory, updateCategory, deleteCategory } from '@/features/catalog/api'
import type { CategoryDto, CategoryCreateBody, CategoryUpdateBody } from '@/features/catalog/types'

interface CategoryFormData {
  name: string
  slug: string
  description: string
  imageUrl: string
  parentId: string
  displayOrder: string
  isActive: boolean
}

function emptyForm(): CategoryFormData {
  return {
    name: '',
    slug: '',
    description: '',
    imageUrl: '',
    parentId: '',
    displayOrder: '0',
    isActive: true,
  }
}

function formToBody(data: CategoryFormData): CategoryCreateBody {
  return {
    name: data.name,
    slug: data.slug || undefined,
    description: data.description || undefined,
    imageUrl: data.imageUrl || undefined,
    parentId: data.parentId || null,
    displayOrder: Number(data.displayOrder),
    isActive: data.isActive,
  }
}

function categoryToForm(category: CategoryDto): CategoryFormData {
  return {
    name: category.name,
    slug: category.slug,
    description: category.description ?? '',
    imageUrl: category.imageUrl ?? '',
    parentId: category.parentId ?? '',
    displayOrder: String(category.displayOrder),
    isActive: category.isActive,
  }
}

export function AdminCategoriesPage() {
  const queryClient = useQueryClient()
  const { confirm, Dialog: ConfirmDialogComponent } = useConfirmDialog()
  const [isOpen, setIsOpen] = useState(false)
  const [editing, setEditing] = useState<CategoryDto | null>(null)
  const [form, setForm] = useState<CategoryFormData>(emptyForm())

  const { data, isLoading } = useQuery({
    queryKey: ['categories'],
    queryFn: () => getCategories(false),
  })

  const createMutation = useMutation({
    mutationFn: createCategory,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['categories'] })
      setIsOpen(false)
      setForm(emptyForm())
      toast.success('دسته‌بندی ایجاد شد')
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ slug, body }: { slug: string; body: CategoryUpdateBody }) => updateCategory(slug, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['categories'] })
      setIsOpen(false)
      setEditing(null)
      setForm(emptyForm())
      toast.success('دسته‌بندی به‌روزرسانی شد')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: deleteCategory,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['categories'] })
      toast.success('دسته‌بندی حذف شد')
    },
  })

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm())
    setIsOpen(true)
  }

  const openEdit = (category: CategoryDto) => {
    setEditing(category)
    setForm(categoryToForm(category))
    setIsOpen(true)
  }

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    if (editing) {
      updateMutation.mutate({ slug: editing.slug, body: formToBody(form) })
    } else {
      createMutation.mutate(formToBody(form))
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

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'ویرایش دسته‌بندی' : 'دسته‌بندی جدید'}</DialogTitle>
            <DialogDescription>اطلاعات دسته‌بندی را وارد کنید.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">نام</label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">اسلاگ</label>
              <Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="اختیاری" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">توضیحات</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="min-h-[80px] w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/20"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">تصویر (URL)</label>
              <Input value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">والد</label>
              <Input value={form.parentId} onChange={(e) => setForm({ ...form, parentId: e.target.value })} placeholder="ID والد" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">ترتیب نمایش</label>
              <Input type="number" value={form.displayOrder} onChange={(e) => setForm({ ...form, displayOrder: e.target.value })} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">فعال</span>
              <Switch checked={form.isActive} onCheckedChange={(checked) => setForm({ ...form, isActive: checked })} />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>انصراف</Button>
              <Button type="submit" loading={createMutation.isPending || updateMutation.isPending}>ذخیره</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialogComponent />
    </ScrollReveal>
  )
}
