import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, ExternalLink, RotateCcw, Save } from 'lucide-react'
import { toast } from 'sonner'
import { Link } from 'react-router'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { ImageUploader } from '@/components/ui/ImageUploader'
import { Switch } from '@/components/ui/Switch'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { PageHeader } from '@/components/layout/Breadcrumbs'
import { ScrollReveal } from '@/components/motion/ScrollReveal'
import { getAdminSettings, updateAdminSetting } from '../api'
import {
  describeSetting,
  FALLBACK_GROUP,
  GROUP_META,
  GROUP_ORDER,
  SETTING_META,
} from '../settings-catalog'
import type { SettingDto } from '../types'

/** The catalog wins when it declares a kind; otherwise infer from the value. */
function settingKind(setting: SettingDto): 'text' | 'boolean' | 'image' {
  const declared = SETTING_META[setting.key]?.kind
  if (declared) return declared
  return ['true', 'false'].includes(setting.value.toLowerCase()) ? 'boolean' : 'text'
}

/** Shared save/invalidate wiring for every control on this page. */
function useSettingMutation(
  key: string,
  handlers: { onSuccess?: () => void; onError?: () => void } = {},
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (nextValue: string) => updateAdminSetting(key, { value: nextValue }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'settings'] })
      void queryClient.invalidateQueries({ queryKey: ['settings', 'public'] })
      // The Seo component caches public settings under its own key.
      void queryClient.invalidateQueries({ queryKey: ['public-settings'] })
      handlers.onSuccess?.()
    },
    onError: (error: unknown) => {
      handlers.onError?.()
      toast.error(error instanceof Error ? error.message : 'ذخیره تنظیم ناموفق بود')
    },
  })
}

/** A labelled on/off row — the common case for "show this section". */
function ToggleSetting({ setting }: { setting: SettingDto }) {
  const meta = describeSetting(setting.key, setting.description)
  const [optimistic, setOptimistic] = useState<boolean | null>(null)

  const mutation = useSettingMutation(setting.key, {
    onSuccess: () => {
      setOptimistic(null)
      toast.success(`${meta.label} به‌روزرسانی شد`)
    },
    // Snap back: the switch must not claim a state the server rejected.
    onError: () => setOptimistic(null),
  })

  const checked = optimistic ?? setting.value === 'true'

  return (
    <div className="flex items-start justify-between gap-4 py-4">
      <div className="min-w-0 flex-1">
        <p className="font-medium text-foreground">{meta.label}</p>
        <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{meta.help}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2 pt-0.5">
        <span className={`text-xs ${checked ? 'text-success' : 'text-muted-foreground'}`}>
          {checked ? 'روشن' : 'خاموش'}
        </span>
        <Switch
          checked={checked}
          disabled={mutation.isPending}
          onCheckedChange={(next) => {
            setOptimistic(next)
            mutation.mutate(next ? 'true' : 'false')
          }}
          aria-label={meta.label}
        />
      </div>
    </div>
  )
}

/** A text setting with explicit save/revert, so typing never auto-commits. */
function TextSetting({ setting }: { setting: SettingDto }) {
  const meta = describeSetting(setting.key, setting.description)
  const [value, setValue] = useState(setting.value)

  const mutation = useSettingMutation(setting.key, {
    onSuccess: () => toast.success(`${meta.label} ذخیره شد`),
  })

  const hasChanged = value !== setting.value

  return (
    <div className="py-4">
      <label className="block">
        <span className="font-medium text-foreground">{meta.label}</span>
        <span className="mt-0.5 block text-sm leading-relaxed text-muted-foreground">{meta.help}</span>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Input
            value={value}
            onChange={(event) => setValue(event.target.value)}
            className="max-w-md flex-1"
          />
          {hasChanged && (
            <>
              <Button size="sm" loading={mutation.isPending} onClick={() => mutation.mutate(value)}>
                <Save className="h-4 w-4" />
                <span className="ms-1">ذخیره</span>
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setValue(setting.value)}
                disabled={mutation.isPending}
              >
                <RotateCcw className="h-4 w-4" />
                <span className="sr-only">بازگرداندن</span>
              </Button>
            </>
          )}
          {!hasChanged && !mutation.isPending && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Check className="h-3.5 w-3.5" />
              ذخیره شده
            </span>
          )}
        </div>
      </label>
    </div>
  )
}

/**
 * An image setting (logo, favicon). Uploading commits immediately — an image
 * that is on the server but not referenced by the setting is just an orphan
 * file, so there is nothing useful for an admin to "save" afterwards.
 */
function ImageSetting({ setting }: { setting: SettingDto }) {
  const meta = describeSetting(setting.key, setting.description)

  const mutation = useSettingMutation(setting.key, {
    onSuccess: () => toast.success(`${meta.label} ذخیره شد`),
  })

  const url = setting.value.trim()

  return (
    <div className="py-4">
      <p className="font-medium text-foreground">{meta.label}</p>
      <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{meta.help}</p>

      <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="max-w-sm flex-1">
          <ImageUploader
            value={url ? [{ url, isPrimary: true }] : []}
            onChange={(images) => mutation.mutate(images[0]?.url ?? '')}
            maxFiles={1}
            disabled={mutation.isPending}
            altTextFallback={meta.label}
          />
        </div>

        {url && (
          // A live preview on the real surface: a logo that looks fine in the
          // uploader tile can still be unreadable in the header.
          <div className="w-full max-w-xs shrink-0 rounded-xl border border-border bg-background p-4">
            <p className="mb-2 text-xs text-muted-foreground">پیش‌نمایش</p>
            <img
              src={url}
              alt={meta.label}
              className={
                setting.key === 'site_favicon_url'
                  ? 'h-8 w-8 rounded object-contain'
                  : 'h-10 max-w-full object-contain'
              }
            />
          </div>
        )}
      </div>
    </div>
  )
}

export function AdminSettingsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'settings'],
    queryFn: getAdminSettings,
  })

  const settings = data?.settings ?? []

  // Group by the API's `group` field, ordered by GROUP_ORDER with any unknown
  // groups appended rather than dropped.
  const grouped = new Map<string, SettingDto[]>()
  for (const setting of settings) {
    const list = grouped.get(setting.group) ?? []
    list.push(setting)
    grouped.set(setting.group, list)
  }
  const orderedGroups = [
    ...GROUP_ORDER.filter((key) => grouped.has(key)),
    ...[...grouped.keys()].filter((key) => !GROUP_ORDER.includes(key)),
  ]

  return (
    <ScrollReveal className="space-y-6">
      <PageHeader
        title="تنظیمات فروشگاه"
        description="بخش‌های مختلف سایت را روشن یا خاموش کنید. تغییرات بلافاصله برای مشتریان اعمال می‌شود."
        actions={
          <Button variant="outline" asChild>
            <Link to="/" target="_blank" rel="noreferrer">
              <ExternalLink className="h-4 w-4" />
              <span className="ms-1">مشاهده سایت</span>
            </Link>
          </Button>
        }
      />

      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-40 animate-pulse rounded-2xl bg-muted" />
          ))}
        </div>
      ) : settings.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            هیچ تنظیمی یافت نشد. از بخش «داده‌های نمونه» می‌توانید تنظیمات پیش‌فرض را ایجاد کنید.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6">
          {orderedGroups.map((groupKey) => {
            const meta = GROUP_META[groupKey] ?? FALLBACK_GROUP
            const groupSettings = grouped.get(groupKey) ?? []
            const Icon = meta.icon

            return (
              <Card key={groupKey}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-soft text-primary">
                      <Icon className="h-5 w-5" />
                    </span>
                    {meta.label}
                  </CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">{meta.description}</p>
                </CardHeader>
                <CardContent className="divide-y divide-border pt-0">
                  {groupSettings.map((setting) => {
                    switch (settingKind(setting)) {
                      case 'boolean':
                        return <ToggleSetting key={setting.id} setting={setting} />
                      case 'image':
                        return <ImageSetting key={setting.id} setting={setting} />
                      default:
                        return <TextSetting key={setting.id} setting={setting} />
                    }
                  })}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </ScrollReveal>
  )
}
