import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, Pencil, Power } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { ScrollReveal } from '@/components/motion/ScrollReveal'
import {
  createHomepageSection,
  deleteHomepageSection,
  getAdminHomepageSections,
  updateHomepageSection,
} from '../api'
import type { HomepageSectionDto } from '../types'

function formatJson(value: Record<string, unknown>): string {
  return JSON.stringify(value, null, 2)
}

function parseJson(value: string): Record<string, unknown> | undefined {
  try {
    const parsed = JSON.parse(value)
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) ? parsed : undefined
  } catch {
    return undefined
  }
}

function SectionRow({ section }: { section: HomepageSectionDto }) {
  const queryClient = useQueryClient()
  const [isEditing, setIsEditing] = useState(false)
  const [title, setTitle] = useState(section.title)
  const [type, setType] = useState(section.type)
  const [configText, setConfigText] = useState(formatJson(section.config))
  const [displayOrder, setDisplayOrder] = useState(String(section.displayOrder))

  const updateMutation = useMutation({
    mutationFn: (body: Parameters<typeof updateHomepageSection>[1]) => updateHomepageSection(section.id, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'homepage-sections'] })
      setIsEditing(false)
    },
  })

  const toggleMutation = useMutation({
    mutationFn: () => updateHomepageSection(section.id, { isActive: !section.isActive }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'homepage-sections'] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => deleteHomepageSection(section.id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'homepage-sections'] })
    },
  })

  const handleSave = () => {
    const config = parseJson(configText)
    if (config === undefined) {
      alert('JSON وارد شده معتبر نیست')
      return
    }
    updateMutation.mutate({
      title,
      type,
      config,
      displayOrder: Number(displayOrder),
    })
  }

  return (
    <tr>
      <td className="px-4 py-3 font-medium text-foreground">{section.key}</td>
      <td className="px-4 py-3">
        {isEditing ? (
          <Input value={title} onChange={(event) => setTitle(event.target.value)} />
        ) : (
          section.title
        )}
      </td>
      <td className="px-4 py-3">
        {isEditing ? (
          <Input value={type} onChange={(event) => setType(event.target.value)} />
        ) : (
          <Badge variant="secondary">{section.type}</Badge>
        )}
      </td>
      <td className="px-4 py-3">
        {isEditing ? (
          <Input value={displayOrder} onChange={(event) => setDisplayOrder(event.target.value)} />
        ) : (
          section.displayOrder
        )}
      </td>
      <td className="px-4 py-3">
        {isEditing ? (
          <textarea
            value={configText}
            onChange={(event) => setConfigText(event.target.value)}
            rows={4}
            className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/20"
          />
        ) : (
          <pre className="max-w-xs overflow-auto rounded-xl bg-muted p-2 text-xs text-foreground">
            {formatJson(section.config)}
          </pre>
        )}
      </td>
      <td className="px-4 py-3">
        <Badge variant={section.isActive ? 'success' : 'danger'}>
          {section.isActive ? 'فعال' : 'غیرفعال'}
        </Badge>
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-2">
          {isEditing ? (
            <>
              <Button size="sm" loading={updateMutation.isPending} onClick={handleSave}>
                ذخیره
              </Button>
              <Button size="sm" variant="outline" onClick={() => setIsEditing(false)}>
                انصراف
              </Button>
            </>
          ) : (
            <>
              <Button size="sm" variant="outline" onClick={() => setIsEditing(true)}>
                <Pencil className="h-4 w-4" />
                <span className="sr-only">ویرایش</span>
              </Button>
              <Button
                size="sm"
                variant="outline"
                loading={toggleMutation.isPending}
                onClick={() => toggleMutation.mutate()}
              >
                <Power className="h-4 w-4" />
                <span className="sr-only">{section.isActive ? 'غیرفعال کردن' : 'فعال کردن'}</span>
              </Button>
              <Button
                size="sm"
                variant="danger"
                loading={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate()}
              >
                <Trash2 className="h-4 w-4" />
                <span className="sr-only">حذف</span>
              </Button>
            </>
          )}
        </div>
      </td>
    </tr>
  )
}

export function AdminHomepageSectionsPage() {
  const queryClient = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'homepage-sections'],
    queryFn: getAdminHomepageSections,
  })

  const [isCreating, setIsCreating] = useState(false)
  const [newKey, setNewKey] = useState('')
  const [newTitle, setNewTitle] = useState('')
  const [newType, setNewType] = useState('')

  const createMutation = useMutation({
    mutationFn: createHomepageSection,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'homepage-sections'] })
      setIsCreating(false)
      setNewKey('')
      setNewTitle('')
      setNewType('')
    },
  })

  return (
    <ScrollReveal className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground md:text-3xl">بخش‌های صفحه اصلی</h1>
          <p className="mt-2 text-muted-foreground">ترتیب، فعال‌سازی و محتوای هر بخش را مدیریت کنید.</p>
        </div>
        <Button onClick={() => setIsCreating(true)} className="inline-flex items-center gap-2">
          <Plus className="h-4 w-4" />
          بخش جدید
        </Button>
      </div>

      {isCreating && (
        <Card>
          <CardHeader>
            <CardTitle>بخش جدید</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-3">
              <Input placeholder="کلید (key)" value={newKey} onChange={(event) => setNewKey(event.target.value)} />
              <Input placeholder="عنوان" value={newTitle} onChange={(event) => setNewTitle(event.target.value)} />
              <Input placeholder="نوع" value={newType} onChange={(event) => setNewType(event.target.value)} />
            </div>
            <div className="mt-4 flex gap-2">
              <Button
                size="sm"
                loading={createMutation.isPending}
                onClick={() =>
                  createMutation.mutate({
                    key: newKey,
                    title: newTitle,
                    type: newType,
                  })
                }
              >
                ایجاد
              </Button>
              <Button size="sm" variant="outline" onClick={() => setIsCreating(false)}>
                انصراف
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>لیست بخش‌ها</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">کلید</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">عنوان</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">نوع</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">ترتیب</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">تنظیمات</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">وضعیت</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">عملیات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                      در حال بارگذاری ...
                    </td>
                  </tr>
                ) : data?.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                      بخشی یافت نشد.
                    </td>
                  </tr>
                ) : (
                  data?.map((section) => <SectionRow key={section.id} section={section} />)
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </ScrollReveal>
  )
}
