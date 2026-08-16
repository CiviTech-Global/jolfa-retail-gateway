import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Switch } from '@/components/ui/Switch'
import { Badge } from '@/components/ui/Badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/Dialog'
import { ScrollReveal } from '@/components/motion/ScrollReveal'
import { getAdminBanners, createBanner, updateBanner, deleteBanner } from '@/features/cms/api'
import type { BannerDto, BannerCreateBody, BannerUpdateBody } from '@/features/cms/types'

interface BannerFormData {
  title: string
  subtitle: string
  imageUrl: string
  link: string
  position: string
  displayOrder: string
  isActive: boolean
}

function emptyForm(): BannerFormData {
  return { title: '', subtitle: '', imageUrl: '', link: '', position: 'hero', displayOrder: '0', isActive: true }
}

function formToBody(data: BannerFormData): BannerCreateBody {
  return {
    title: data.title,
    subtitle: data.subtitle || undefined,
    imageUrl: data.imageUrl,
    link: data.link || undefined,
    position: data.position,
    displayOrder: Number(data.displayOrder),
    isActive: data.isActive,
  }
}

function bannerToForm(banner: BannerDto): BannerFormData {
  return {
    title: banner.title,
    subtitle: banner.subtitle ?? '',
    imageUrl: banner.imageUrl,
    link: banner.link ?? '',
    position: banner.position,
    displayOrder: String(banner.displayOrder),
    isActive: banner.isActive,
  }
}

export function AdminBannersPage() {
  const queryClient = useQueryClient()
  const [isOpen, setIsOpen] = useState(false)
  const [editing, setEditing] = useState<BannerDto | null>(null)
  const [form, setForm] = useState<BannerFormData>(emptyForm())

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'banners'],
    queryFn: getAdminBanners,
  })

  const createMutation = useMutation({
    mutationFn: createBanner,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'banners'] })
      setIsOpen(false)
      setForm(emptyForm())
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: BannerUpdateBody }) => updateBanner(id, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'banners'] })
      setIsOpen(false)
      setEditing(null)
      setForm(emptyForm())
    },
  })

  const deleteMutation = useMutation({
    mutationFn: deleteBanner,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'banners'] })
    },
  })

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm())
    setIsOpen(true)
  }

  const openEdit = (banner: BannerDto) => {
    setEditing(banner)
    setForm(bannerToForm(banner))
    setIsOpen(true)
  }

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    if (editing) {
      updateMutation.mutate({ id: editing.id, body: formToBody(form) })
    } else {
      createMutation.mutate(formToBody(form))
    }
  }

  const banners = data?.banners ?? []

  return (
    <ScrollReveal className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground md:text-3xl">مدیریت بنرها</h1>
          <p className="mt-2 text-muted-foreground">بنرهای صفحه اصلی را مدیریت کنید.</p>
        </div>
        <Button onClick={openCreate} className="inline-flex items-center gap-2">
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
                      <td className="px-4 py-3 text-muted-foreground">{banner.position}</td>
                      <td className="px-4 py-3">
                        <Badge variant={banner.isActive ? 'success' : 'danger'}>
                          {banner.isActive ? 'فعال' : 'غیرفعال'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-foreground">{banner.displayOrder}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" variant="outline" onClick={() => openEdit(banner)}>
                            <Pencil className="h-4 w-4" />
                            <span className="sr-only">ویرایش</span>
                          </Button>
                          <Button size="sm" variant="danger" loading={deleteMutation.isPending} onClick={() => deleteMutation.mutate(banner.id)}>
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
            <DialogTitle>{editing ? 'ویرایش بنر' : 'بنر جدید'}</DialogTitle>
            <DialogDescription>اطلاعات بنر را وارد کنید.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">عنوان</label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">زیرعنوان</label>
              <Input value={form.subtitle} onChange={(e) => setForm({ ...form, subtitle: e.target.value })} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">تصویر (URL)</label>
              <Input value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} required />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">لینک</label>
              <Input value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">موقعیت</label>
              <Input value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} />
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
    </ScrollReveal>
  )
}
