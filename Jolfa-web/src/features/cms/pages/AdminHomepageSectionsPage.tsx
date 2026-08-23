import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowDown, ArrowUp, Eye, EyeOff, GripVertical, Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { Card, CardContent } from '@/components/ui/Card'
import { Switch } from '@/components/ui/Switch'
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
import { PageHeader } from '@/components/layout/Breadcrumbs'
import { ScrollReveal } from '@/components/motion/ScrollReveal'
import { useConfirmDialog } from '@/hooks/useConfirmDialog'
import { SECTION_TYPE_OPTIONS } from '../section-registry'
import {
  createHomepageSection,
  deleteHomepageSection,
  getAdminHomepageSections,
  updateHomepageSection,
} from '../api'
import type { HomepageSectionDto } from '../types'

function typeLabel(type: string): string {
  return SECTION_TYPE_OPTIONS.find((option) => option.value === type)?.label ?? type
}

function formatJson(value: Record<string, unknown>): string {
  return JSON.stringify(value, null, 2)
}

function parseJson(value: string): Record<string, unknown> | undefined {
  try {
    const parsed: unknown = JSON.parse(value)
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : undefined
  } catch {
    return undefined
  }
}

/** Slug-ish key derived from the title, so admins never have to invent one. */
function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9؀-ۿ]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50)
}

interface EditorState {
  mode: 'create' | 'edit'
  section?: HomepageSectionDto
}

export function AdminHomepageSectionsPage() {
  const queryClient = useQueryClient()
  const { confirm, Dialog: ConfirmDialogComponent } = useConfirmDialog()
  const [editor, setEditor] = useState<EditorState | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'homepage-sections'],
    queryFn: getAdminHomepageSections,
  })

  const sections = [...(data ?? [])].sort((a, b) => a.displayOrder - b.displayOrder)

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['admin', 'homepage-sections'] })

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      updateHomepageSection(id, { isActive }),
    onSuccess: (_result, variables) => {
      void invalidate()
      toast.success(variables.isActive ? 'بخش نمایش داده می‌شود' : 'بخش پنهان شد')
    },
    onError: (error: unknown) =>
      toast.error(error instanceof Error ? error.message : 'تغییر وضعیت ناموفق بود'),
  })

  const reorderMutation = useMutation({
    mutationFn: async ({ a, b }: { a: HomepageSectionDto; b: HomepageSectionDto }) => {
      await Promise.all([
        updateHomepageSection(a.id, { displayOrder: b.displayOrder }),
        updateHomepageSection(b.id, { displayOrder: a.displayOrder }),
      ])
    },
    onSuccess: () => void invalidate(),
    onError: (error: unknown) =>
      toast.error(error instanceof Error ? error.message : 'تغییر ترتیب ناموفق بود'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteHomepageSection(id),
    onSuccess: () => {
      void invalidate()
      toast.success('بخش حذف شد')
    },
    onError: (error: unknown) =>
      toast.error(error instanceof Error ? error.message : 'حذف بخش ناموفق بود'),
  })

  const move = (index: number, direction: -1 | 1) => {
    const current = sections[index]
    const target = sections[index + direction]
    if (!current || !target) return
    reorderMutation.mutate({ a: current, b: target })
  }

  const handleDelete = async (section: HomepageSectionDto) => {
    const ok = await confirm({
      title: 'حذف بخش',
      description: `«${section.title}» از صفحه اصلی حذف شود؟ این عملیات قابل بازگشت نیست.`,
      confirmText: 'حذف',
      cancelText: 'انصراف',
      variant: 'danger',
    })
    if (ok) deleteMutation.mutate(section.id)
  }

  const activeCount = sections.filter((section) => section.isActive).length

  return (
    <ScrollReveal className="space-y-6">
      <PageHeader
        title="بخش‌های صفحه اصلی"
        description="ترتیب بخش‌ها را تغییر دهید و هر کدام را برای مشتریان نمایش دهید یا پنهان کنید."
        actions={
          <Button onClick={() => setEditor({ mode: 'create' })} className="inline-flex items-center gap-2">
            <Plus className="h-4 w-4" />
            بخش جدید
          </Button>
        }
      />

      {!isLoading && sections.length > 0 && (
        <p className="text-sm text-muted-foreground">
          {activeCount} بخش از {sections.length} بخش روی صفحه اصلی نمایش داده می‌شود.
        </p>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-muted" />
          ))}
        </div>
      ) : sections.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            هنوز بخشی تعریف نشده است.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {sections.map((section, index) => (
            <Card
              key={section.id}
              className={section.isActive ? undefined : 'opacity-70'}
            >
              <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
                {/* Order controls */}
                <div className="flex shrink-0 items-center gap-1">
                  <GripVertical className="h-4 w-4 text-border" aria-hidden="true" />
                  <div className="flex flex-col">
                    <button
                      type="button"
                      onClick={() => move(index, -1)}
                      disabled={index === 0 || reorderMutation.isPending}
                      className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
                      aria-label={`انتقال «${section.title}» به بالا`}
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => move(index, 1)}
                      disabled={index === sections.length - 1 || reorderMutation.isPending}
                      className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
                      aria-label={`انتقال «${section.title}» به پایین`}
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <span className="w-6 text-center text-sm font-medium text-muted-foreground">
                    {index + 1}
                  </span>
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-foreground">{section.title}</p>
                    <Badge variant="secondary">{typeLabel(section.type)}</Badge>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">شناسه: {section.key}</p>
                </div>

                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-border px-3 py-1.5">
                    {section.isActive ? (
                      <Eye className="h-4 w-4 text-success" />
                    ) : (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span className="text-sm text-foreground">
                      {section.isActive ? 'نمایش' : 'پنهان'}
                    </span>
                    <Switch
                      checked={section.isActive}
                      disabled={toggleMutation.isPending}
                      onCheckedChange={(next) =>
                        toggleMutation.mutate({ id: section.id, isActive: next })
                      }
                      aria-label={`نمایش بخش ${section.title}`}
                    />
                  </label>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setEditor({ mode: 'edit', section })}
                  >
                    <Pencil className="h-4 w-4" />
                    <span className="sr-only">ویرایش {section.title}</span>
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    loading={deleteMutation.isPending}
                    onClick={() => void handleDelete(section)}
                  >
                    <Trash2 className="h-4 w-4" />
                    <span className="sr-only">حذف {section.title}</span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <SectionEditorDialog
        state={editor}
        existingKeys={sections.map((section) => section.key)}
        onClose={() => setEditor(null)}
        onSaved={() => {
          void invalidate()
          setEditor(null)
        }}
      />

      <ConfirmDialogComponent />
    </ScrollReveal>
  )
}

function SectionEditorDialog({
  state,
  existingKeys,
  onClose,
  onSaved,
}: {
  state: EditorState | null
  existingKeys: string[]
  onClose: () => void
  onSaved: () => void
}) {
  return (
    <Dialog
      open={state !== null}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent size="lg">
        {/* Remounting on the target keeps the form's initial state honest;
            syncing props into state via an effect causes cascading renders. */}
        {state && (
          <SectionEditorForm
            key={state.section?.id ?? 'new'}
            state={state}
            existingKeys={existingKeys}
            onClose={onClose}
            onSaved={onSaved}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function SectionEditorForm({
  state,
  existingKeys,
  onClose,
  onSaved,
}: {
  state: EditorState
  existingKeys: string[]
  onClose: () => void
  onSaved: () => void
}) {
  const isEdit = state.mode === 'edit'
  const section = state.section

  const [title, setTitle] = useState(section?.title ?? '')
  const [key, setKey] = useState(section?.key ?? '')
  const [type, setType] = useState(section?.type ?? SECTION_TYPE_OPTIONS[0].value)
  const [configText, setConfigText] = useState(section ? formatJson(section.config) : '{}')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const saveMutation = useMutation({
    mutationFn: async () => {
      const config = parseJson(configText)
      if (config === undefined) {
        throw new Error('تنظیمات پیشرفته باید یک JSON معتبر باشد')
      }
      if (isEdit && section) {
        return updateHomepageSection(section.id, { title, type, config })
      }
      return createHomepageSection({ key: key || slugify(title), title, type, config })
    },
    onSuccess: () => {
      toast.success(isEdit ? 'بخش به‌روزرسانی شد' : 'بخش ایجاد شد')
      onSaved()
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : 'ذخیره بخش ناموفق بود'
      if (message.includes('JSON')) {
        setErrors({ config: message })
        setShowAdvanced(true)
        return
      }
      toast.error(message)
    },
  })

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    const nextErrors: Record<string, string> = {}

    if (!title.trim()) {
      nextErrors.title = 'عنوان بخش الزامی است'
    }
    if (!isEdit) {
      const finalKey = key || slugify(title)
      if (!finalKey) {
        nextErrors.key = 'شناسه بخش الزامی است'
      } else if (existingKeys.includes(finalKey)) {
        nextErrors.key = 'این شناسه قبلاً استفاده شده است'
      }
    }
    if (parseJson(configText) === undefined) {
      nextErrors.config = 'تنظیمات پیشرفته باید یک JSON معتبر باشد'
      setShowAdvanced(true)
    }

    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return
    saveMutation.mutate()
  }

  const typeOptions =
    section && !SECTION_TYPE_OPTIONS.some((option) => option.value === section.type)
      ? [{ value: section.type, label: `${section.type} (نوع قدیمی)` }, ...SECTION_TYPE_OPTIONS]
      : SECTION_TYPE_OPTIONS

  return (
    <>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'ویرایش بخش' : 'بخش جدید'}</DialogTitle>
          <DialogDescription>
            عنوان و نوع بخش را انتخاب کنید. تنظیمات پیشرفته اختیاری است.
          </DialogDescription>
        </DialogHeader>

        <DialogForm onSubmit={submit}>
          <DialogBody className="space-y-4">
            <FormField label="عنوان بخش" required error={errors.title}>
              {(field) => (
                <Input
                  {...field}
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="مثلاً پرفروش‌ترین‌ها"
                />
              )}
            </FormField>

            {!isEdit && (
              <FormField
                label="شناسه بخش"
                error={errors.key}
                hint="خالی بگذارید تا از روی عنوان ساخته شود. بعداً قابل تغییر نیست."
              >
                {(field) => (
                  <Input
                    {...field}
                    value={key}
                    dir="ltr"
                    onChange={(event) => setKey(event.target.value)}
                    placeholder={slugify(title) || 'best-sellers'}
                  />
                )}
              </FormField>
            )}

            <FormField label="نوع نمایش" required error={errors.type}>
              {(field) => (
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger id={field.id} aria-invalid={field['aria-invalid']}>
                    <SelectValue placeholder="نوع بخش" />
                  </SelectTrigger>
                  <SelectContent>
                    {typeOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </FormField>

            {/* Raw JSON is a power-user escape hatch, not the default view. */}
            <div className="rounded-xl border border-border">
              <button
                type="button"
                onClick={() => setShowAdvanced((value) => !value)}
                className="flex w-full items-center justify-between p-3 text-sm font-medium text-foreground"
                aria-expanded={showAdvanced}
              >
                <span>تنظیمات پیشرفته (JSON)</span>
                <span className="text-xs text-muted-foreground">
                  {showAdvanced ? 'بستن' : 'نمایش'}
                </span>
              </button>
              {showAdvanced && (
                <div className="border-t border-border p-3">
                  <Textarea
                    value={configText}
                    onChange={(event) => setConfigText(event.target.value)}
                    rows={8}
                    dir="ltr"
                    aria-invalid={Boolean(errors.config)}
                    className="font-mono text-xs"
                  />
                  {errors.config ? (
                    <p role="alert" className="mt-1 text-sm text-danger">
                      {errors.config}
                    </p>
                  ) : (
                    <p className="mt-1 text-xs text-muted-foreground">
                      تنظیمات اختصاصی این نوع بخش. در صورت تردید تغییری ندهید.
                    </p>
                  )}
                </div>
              )}
            </div>
          </DialogBody>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              انصراف
            </Button>
            <Button type="submit" loading={saveMutation.isPending}>
              ذخیره
            </Button>
          </DialogFooter>
        </DialogForm>
    </>
  )
}
