import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { ArrowDown, ArrowUp, Eye, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { FormField } from '@/components/ui/FormField'
import { ImageUploader } from '@/components/ui/ImageUploader'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select'
import { ScrollReveal } from '@/components/motion/ScrollReveal'
import { useConfirmDialog } from '@/hooks/useConfirmDialog'
import { getContentPage, updateContentPage } from './api'
import { CONTENT_ICONS, type ContentBlock, type ContentBlockType, type ContentIcon } from './types'

const PAGE_LABELS: Record<string, { label: string; path: string; setting: string }> = {
  about: { label: 'درباره ما', path: '/about', setting: 'صفحه «درباره ما»' },
  contact: { label: 'تماس با ما', path: '/contact', setting: 'صفحه «تماس با ما»' },
  rules: { label: 'قوانین و مقررات', path: '/rules', setting: 'صفحه «قوانین»' },
}

const BLOCK_LABELS: Record<ContentBlockType, string> = {
  heading: 'عنوان صفحه',
  text: 'متن',
  feature_cards: 'کارت‌های ویژگی',
  stats: 'آمار',
  image: 'تصویر',
  cta: 'دعوت به اقدام',
}

const ICON_LABELS: Record<ContentIcon, string> = {
  store: 'فروشگاه',
  leaf: 'برگ',
  truck: 'ارسال',
  shield: 'تضمین',
  heart: 'قلب',
  sparkles: 'درخشش',
  headphones: 'پشتیبانی',
  package: 'بسته',
  clock: 'ساعت',
  award: 'نشان',
  phone: 'تلفن',
  mail: 'ایمیل',
  map_pin: 'آدرس',
  credit_card: 'پرداخت',
  refresh: 'بازگشت',
  alert: 'هشدار',
}

/** Ids only need to be unique inside one page; they key the React list. */
function newId(): string {
  return `b-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

function emptyBlock(type: ContentBlockType): ContentBlock {
  const id = newId()
  switch (type) {
    case 'heading':
      return { id, type, text: '', subtitle: '', align: 'center' }
    case 'text':
      return { id, type, title: '', body: '' }
    case 'feature_cards':
      return { id, type, title: '', cards: [{ icon: 'sparkles', title: '', description: '' }] }
    case 'stats':
      return { id, type, title: '', items: [{ value: '', label: '' }] }
    case 'image':
      return { id, type, url: '', alt: '', caption: '' }
    case 'cta':
      return { id, type, title: '', description: '', buttonLabel: '', buttonUrl: '/products' }
  }
}

export function AdminContentPagesPage() {
  const { slug = 'about' } = useParams<{ slug?: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { confirm, Dialog } = useConfirmDialog()

  const meta = PAGE_LABELS[slug] ?? PAGE_LABELS.about

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'content-page', slug],
    queryFn: () => getContentPage(slug),
  })

  /**
   * Unsaved edits, or null when the admin has not touched anything yet.
   *
   * Deliberately an overlay on the server's copy rather than state copied into
   * `useState` by an effect. Copying would need the effect to know when it is
   * allowed to run: too eager and a background refetch silently wipes what the
   * admin is typing, too cautious and switching pages shows the previous page's
   * text. With an overlay, "not edited" is simply the absence of a draft, and
   * loading a different page needs no synchronising at all.
   */
  interface PageDraft {
    title: string
    metaDescription: string
    blocks: ContentBlock[]
  }
  const [draft, setDraft] = useState<PageDraft | null>(null)

  const page = data?.page
  const title = draft?.title ?? page?.title ?? ''
  const metaDescription = draft?.metaDescription ?? page?.metaDescription ?? ''
  const blocks = draft?.blocks ?? page?.blocks ?? []
  const dirty = draft !== null

  /** Starts a draft from whatever is on screen, then applies the change. */
  const edit = (patch: Partial<PageDraft>) =>
    setDraft((current) => ({ title, metaDescription, blocks, ...current, ...patch }))

  const saveMutation = useMutation({
    mutationFn: () =>
      updateContentPage(slug, {
        title,
        metaDescription: metaDescription.trim() === '' ? null : metaDescription,
        blocks,
      }),
    onSuccess: () => {
      setDraft(null)
      void queryClient.invalidateQueries({ queryKey: ['admin', 'content-page', slug] })
      // The storefront reads its own copy of this page; without this the admin
      // would save, open the page and still see the old words.
      void queryClient.invalidateQueries({ queryKey: ['content-page', slug] })
      toast.success('صفحه ذخیره شد')
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : 'ذخیره صفحه ناموفق بود'),
  })

  const patchBlock = (index: number, patch: Partial<ContentBlock>) => {
    edit({
      blocks: blocks.map((block, i) =>
        i === index ? ({ ...block, ...patch } as ContentBlock) : block,
      ),
    })
  }

  const moveBlock = (index: number, direction: -1 | 1) => {
    const target = index + direction
    if (target < 0 || target >= blocks.length) return
    const next = [...blocks]
    const [moved] = next.splice(index, 1)
    next.splice(target, 0, moved)
    edit({ blocks: next })
  }

  const removeBlock = async (index: number) => {
    const ok = await confirm({
      title: 'حذف بلوک',
      description: 'این بخش از صفحه حذف شود؟',
      confirmText: 'حذف',
      cancelText: 'انصراف',
      variant: 'danger',
    })
    if (!ok) return
    edit({ blocks: blocks.filter((_, i) => i !== index) })
  }

  const addBlock = (type: ContentBlockType) => {
    edit({ blocks: [...blocks, emptyBlock(type)] })
  }

  return (
    <ScrollReveal className="space-y-6">
      <PageHeader
        title="صفحات سایت"
        description="متن صفحه‌های «درباره ما»، «تماس با ما» و «قوانین» را اینجا ویرایش کنید."
        action={
          <Button variant="outline" asChild>
            <a href={meta.path} target="_blank" rel="noreferrer noopener">
              <Eye className="h-4 w-4" />
              مشاهده صفحه
            </a>
          </Button>
        }
      />

      <div className="flex flex-wrap gap-2">
        {Object.entries(PAGE_LABELS).map(([key, value]) => (
          <Button
            key={key}
            size="sm"
            variant={key === slug ? 'solid' : 'outline'}
            onClick={() => {
              setDraft(null)
              navigate(`/admin/pages/${key}`)
            }}
          >
            {value.label}
          </Button>
        ))}
      </div>

      {/* The two switches are easy to confuse, so say plainly which one this is. */}
      <p className="rounded-xl border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
        این بخش فقط محتوای صفحه را تعیین می‌کند. برای اینکه صفحه در سایت نمایش داده شود، «
        {meta.setting}» باید در بخش تنظیمات روشن باشد؛ در غیر این‌صورت بازدیدکننده پیام «۴۰۴» می‌بیند.
      </p>

      {isLoading ? (
        <div className="h-64 animate-pulse rounded-2xl bg-muted" />
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>مشخصات صفحه</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <FormField label="عنوان صفحه" required>
                {(field) => (
                  <Input
                    {...field}
                    value={title}
                    onChange={(event) => edit({ title: event.target.value })}
                  />
                )}
              </FormField>
              <FormField label="توضیح متا (سئو)">
                {(field) => (
                  <Input
                    {...field}
                    value={metaDescription}
                    onChange={(event) => edit({ metaDescription: event.target.value })}
                    placeholder="توضیح کوتاه برای نتایج جستجو"
                  />
                )}
              </FormField>
            </CardContent>
          </Card>

          <div className="space-y-4">
            {blocks.map((block, index) => (
              <Card key={block.id}>
                <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
                  <CardTitle>{BLOCK_LABELS[block.type] ?? block.type}</CardTitle>
                  <div className="flex gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => moveBlock(index, -1)}
                      disabled={index === 0}
                      aria-label="انتقال به بالا"
                    >
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => moveBlock(index, 1)}
                      disabled={index === blocks.length - 1}
                      aria-label="انتقال به پایین"
                    >
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => void removeBlock(index)}
                      aria-label="حذف بلوک"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <BlockEditor block={block} onChange={(patch) => patchBlock(index, patch)} />
                </CardContent>
              </Card>
            ))}

            {blocks.length === 0 && (
              <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
                این صفحه هیچ بلوکی ندارد. از پایین یک بلوک اضافه کنید.
              </div>
            )}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>افزودن بلوک</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {(Object.keys(BLOCK_LABELS) as ContentBlockType[]).map((type) => (
                <Button key={type} size="sm" variant="outline" onClick={() => addBlock(type)}>
                  <Plus className="h-4 w-4" />
                  {BLOCK_LABELS[type]}
                </Button>
              ))}
            </CardContent>
          </Card>

          <div className="sticky bottom-4 flex items-center justify-between gap-3 rounded-xl border border-border bg-surface/95 p-4 shadow-md backdrop-blur">
            <span className="text-sm text-muted-foreground">
              {dirty ? 'تغییرات ذخیره نشده است.' : 'همه تغییرات ذخیره شده است.'}
            </span>
            <Button
              onClick={() => saveMutation.mutate()}
              loading={saveMutation.isPending}
              disabled={!dirty}
            >
              ذخیره صفحه
            </Button>
          </div>
        </>
      )}

      <Dialog />
    </ScrollReveal>
  )
}

function BlockEditor({
  block,
  onChange,
}: {
  block: ContentBlock
  onChange: (patch: Partial<ContentBlock>) => void
}) {
  switch (block.type) {
    case 'heading':
      return (
        <div className="grid gap-4">
          <FormField label="عنوان" required>
            {(field) => (
              <Input
                {...field}
                value={block.text}
                onChange={(e) => onChange({ text: e.target.value } as Partial<ContentBlock>)}
              />
            )}
          </FormField>
          <FormField label="زیرعنوان">
            {(field) => (
              <Textarea
                {...field}
                rows={3}
                value={block.subtitle ?? ''}
                onChange={(e) => onChange({ subtitle: e.target.value } as Partial<ContentBlock>)}
              />
            )}
          </FormField>
          <FormField label="چیدمان">
            {(field) => (
              <Select
                value={block.align ?? 'center'}
                onValueChange={(value) => onChange({ align: value } as Partial<ContentBlock>)}
              >
                <SelectTrigger id={field.id}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="center">وسط‌چین</SelectItem>
                  <SelectItem value="start">راست‌چین</SelectItem>
                </SelectContent>
              </Select>
            )}
          </FormField>
        </div>
      )

    case 'text':
      return (
        <div className="grid gap-4">
          <FormField label="عنوان (اختیاری)">
            {(field) => (
              <Input
                {...field}
                value={block.title ?? ''}
                onChange={(e) => onChange({ title: e.target.value } as Partial<ContentBlock>)}
              />
            )}
          </FormField>
          <FormField label="متن" required hint="برای پاراگراف جدید، از کلید Enter استفاده کنید.">
            {(field) => (
              <Textarea
                {...field}
                rows={6}
                value={block.body}
                onChange={(e) => onChange({ body: e.target.value } as Partial<ContentBlock>)}
              />
            )}
          </FormField>
        </div>
      )

    case 'feature_cards':
      return (
        <div className="grid gap-4">
          <FormField label="عنوان بخش (اختیاری)">
            {(field) => (
              <Input
                {...field}
                value={block.title ?? ''}
                onChange={(e) => onChange({ title: e.target.value } as Partial<ContentBlock>)}
              />
            )}
          </FormField>

          <div className="space-y-3">
            {block.cards.map((card, cardIndex) => (
              <div key={cardIndex} className="rounded-xl border border-border p-4">
                <div className="grid gap-3 sm:grid-cols-[10rem_1fr]">
                  <FormField label="آیکن">
                    {(field) => (
                      <Select
                        value={card.icon}
                        onValueChange={(value) =>
                          onChange({
                            cards: block.cards.map((c, i) =>
                              i === cardIndex ? { ...c, icon: value as ContentIcon } : c,
                            ),
                          } as Partial<ContentBlock>)
                        }
                      >
                        <SelectTrigger id={field.id}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CONTENT_ICONS.map((icon) => (
                            <SelectItem key={icon} value={icon}>
                              {ICON_LABELS[icon]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </FormField>
                  <FormField label="عنوان کارت" required>
                    {(field) => (
                      <Input
                        {...field}
                        value={card.title}
                        onChange={(e) =>
                          onChange({
                            cards: block.cards.map((c, i) =>
                              i === cardIndex ? { ...c, title: e.target.value } : c,
                            ),
                          } as Partial<ContentBlock>)
                        }
                      />
                    )}
                  </FormField>
                </div>
                <FormField label="توضیح">
                  {(field) => (
                    <Textarea
                      {...field}
                      rows={2}
                      value={card.description}
                      onChange={(e) =>
                        onChange({
                          cards: block.cards.map((c, i) =>
                            i === cardIndex ? { ...c, description: e.target.value } : c,
                          ),
                        } as Partial<ContentBlock>)
                      }
                    />
                  )}
                </FormField>
                <div className="mt-2 flex justify-end">
                  <Button
                    size="sm"
                    variant="danger"
                    // The server requires at least one card; removing the last
                    // one would make the page unsaveable.
                    disabled={block.cards.length <= 1}
                    onClick={() =>
                      onChange({
                        cards: block.cards.filter((_, i) => i !== cardIndex),
                      } as Partial<ContentBlock>)
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                    حذف کارت
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <div>
            <Button
              size="sm"
              variant="outline"
              disabled={block.cards.length >= 12}
              onClick={() =>
                onChange({
                  cards: [...block.cards, { icon: 'sparkles', title: '', description: '' }],
                } as Partial<ContentBlock>)
              }
            >
              <Plus className="h-4 w-4" />
              افزودن کارت
            </Button>
          </div>
        </div>
      )

    case 'stats':
      return (
        <div className="grid gap-4">
          <FormField label="عنوان بخش (اختیاری)">
            {(field) => (
              <Input
                {...field}
                value={block.title ?? ''}
                onChange={(e) => onChange({ title: e.target.value } as Partial<ContentBlock>)}
              />
            )}
          </FormField>
          {block.items.map((item, itemIndex) => (
            <div key={itemIndex} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
              <FormField label="مقدار" required>
                {(field) => (
                  <Input
                    {...field}
                    value={item.value}
                    onChange={(e) =>
                      onChange({
                        items: block.items.map((it, i) =>
                          i === itemIndex ? { ...it, value: e.target.value } : it,
                        ),
                      } as Partial<ContentBlock>)
                    }
                  />
                )}
              </FormField>
              <FormField label="برچسب" required>
                {(field) => (
                  <Input
                    {...field}
                    value={item.label}
                    onChange={(e) =>
                      onChange({
                        items: block.items.map((it, i) =>
                          i === itemIndex ? { ...it, label: e.target.value } : it,
                        ),
                      } as Partial<ContentBlock>)
                    }
                  />
                )}
              </FormField>
              <Button
                size="sm"
                variant="danger"
                disabled={block.items.length <= 1}
                onClick={() =>
                  onChange({
                    items: block.items.filter((_, i) => i !== itemIndex),
                  } as Partial<ContentBlock>)
                }
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <div>
            <Button
              size="sm"
              variant="outline"
              disabled={block.items.length >= 8}
              onClick={() =>
                onChange({
                  items: [...block.items, { value: '', label: '' }],
                } as Partial<ContentBlock>)
              }
            >
              <Plus className="h-4 w-4" />
              افزودن مورد
            </Button>
          </div>
        </div>
      )

    case 'image':
      return (
        <div className="grid gap-4">
          <FormField label="تصویر" required>
            {() => (
              <ImageUploader
                // The uploader speaks in lists; this block holds one image.
                value={block.url ? [{ url: block.url, isPrimary: true }] : []}
                onChange={(images) =>
                  onChange({ url: images[0]?.url ?? '' } as Partial<ContentBlock>)
                }
                maxFiles={1}
                altTextFallback={block.alt || 'تصویر صفحه'}
              />
            )}
          </FormField>
          <FormField
            label="متن جایگزین"
            hint="برای تصویر تزئینی خالی بگذارید تا صفحه‌خوان آن را نخواند."
          >
            {(field) => (
              <Input
                {...field}
                value={block.alt}
                onChange={(e) => onChange({ alt: e.target.value } as Partial<ContentBlock>)}
              />
            )}
          </FormField>
          <FormField label="زیرنویس">
            {(field) => (
              <Input
                {...field}
                value={block.caption ?? ''}
                onChange={(e) => onChange({ caption: e.target.value } as Partial<ContentBlock>)}
              />
            )}
          </FormField>
        </div>
      )

    case 'cta':
      return (
        <div className="grid gap-4">
          <FormField label="عنوان" required>
            {(field) => (
              <Input
                {...field}
                value={block.title}
                onChange={(e) => onChange({ title: e.target.value } as Partial<ContentBlock>)}
              />
            )}
          </FormField>
          <FormField label="توضیح">
            {(field) => (
              <Textarea
                {...field}
                rows={2}
                value={block.description ?? ''}
                onChange={(e) => onChange({ description: e.target.value } as Partial<ContentBlock>)}
              />
            )}
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="متن دکمه" required>
              {(field) => (
                <Input
                  {...field}
                  value={block.buttonLabel}
                  onChange={(e) =>
                    onChange({ buttonLabel: e.target.value } as Partial<ContentBlock>)
                  }
                />
              )}
            </FormField>
            <FormField label="مقصد دکمه" required hint="مسیر داخلی مثل /products یا نشانی کامل">
              {(field) => (
                <Input
                  {...field}
                  dir="ltr"
                  value={block.buttonUrl}
                  onChange={(e) => onChange({ buttonUrl: e.target.value } as Partial<ContentBlock>)}
                />
              )}
            </FormField>
          </div>
        </div>
      )

    default:
      return null
  }
}
