import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
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
    mutationFn: (body: Parameters<typeof updateHomepageSection>[1]) =>
      updateHomepageSection(section.id, body),
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
          section.type
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
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        ) : (
          <pre className="max-w-xs overflow-auto rounded bg-muted p-2 text-xs text-foreground">
            {formatJson(section.config)}
          </pre>
        )}
      </td>
      <td className="px-4 py-3">
        <span
          className={`rounded-full px-2 py-1 text-xs ${
            section.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
          }`}
        >
          {section.isActive ? 'فعال' : 'غیرفعال'}
        </span>
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
                ویرایش
              </Button>
              <Button
                size="sm"
                variant="outline"
                loading={toggleMutation.isPending}
                onClick={() => toggleMutation.mutate()}
              >
                {section.isActive ? 'غیرفعال کردن' : 'فعال کردن'}
              </Button>
              <Button
                size="sm"
                variant="danger"
                loading={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate()}
              >
                حذف
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
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">بخش‌های صفحه اصلی</h1>
          <p className="mt-2 text-gray-600">ترتیب، فعال‌سازی و محتوای هر بخش را مدیریت کنید.</p>
        </div>
        <Button onClick={() => setIsCreating(true)}>بخش جدید</Button>
      </div>

      {isCreating && (
        <div className="mt-6 rounded-xl border border-border bg-background p-4">
          <h2 className="mb-4 font-semibold text-foreground">بخش جدید</h2>
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
        </div>
      )}

      <div className="mt-6 overflow-hidden rounded-xl border border-border bg-background">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-muted text-foreground">
              <tr>
                <th className="px-4 py-3 text-right">کلید</th>
                <th className="px-4 py-3 text-right">عنوان</th>
                <th className="px-4 py-3 text-right">نوع</th>
                <th className="px-4 py-3 text-right">ترتیب</th>
                <th className="px-4 py-3 text-right">تنظیمات</th>
                <th className="px-4 py-3 text-right">وضعیت</th>
                <th className="px-4 py-3 text-right">عملیات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                    در حال بارگذاری ...
                  </td>
                </tr>
              ) : (
                data?.map((section) => <SectionRow key={section.id} section={section} />)
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
