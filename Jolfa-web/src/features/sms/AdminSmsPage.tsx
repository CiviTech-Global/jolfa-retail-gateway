import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Lock, MessageSquare, Send, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { FormField } from '@/components/ui/FormField'
import { Switch } from '@/components/ui/Switch'
import { Badge } from '@/components/ui/Badge'
import { Alert } from '@/components/ui/Alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs'
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select'
import { Skeleton } from '@/components/ui/Skeleton'
import { ScrollReveal } from '@/components/motion/ScrollReveal'
import { useConfirmDialog } from '@/hooks/useConfirmDialog'
import { getSmsLog, getSmsStatus, getSmsTemplates, sendTestSms, updateSmsTemplate } from './api'
import type { SmsLogRow, SmsTemplate } from './types'

/** What each placeholder is replaced with, in the admin's words. */
const VARIABLE_LABELS: Record<string, string> = {
  code: 'کد یکبار مصرف',
  orderNumber: 'شماره سفارش',
  amount: 'مبلغ سفارش',
  trackingNumber: 'کد رهگیری مرسوله',
  siteName: 'نام فروشگاه',
}

const STATUS_LABELS: Record<
  SmsLogRow['status'],
  { label: string; variant: 'success' | 'danger' | 'warning' }
> = {
  SENT: { label: 'ارسال شد', variant: 'success' },
  FAILED: { label: 'ناموفق', variant: 'danger' },
  PENDING: { label: 'در انتظار', variant: 'warning' },
}

/** `notify()`'s outcomes, as a sentence the shop owner can act on. */
const OUTCOME_MESSAGES: Record<string, string> = {
  sent: 'پیامک ارسال شد.',
  disabled: 'این رویداد خاموش است، بنابراین چیزی ارسال نشد.',
  not_configured: 'کلید وب‌سرویس پیامک تنظیم نشده است؛ متن فقط در گزارش ثبت شد.',
  no_line: 'شماره خط ارسال تنظیم نشده است، بنابراین ارسال متن آزاد ممکن نیست.',
  invalid_number: 'شماره موبایل نادرست است.',
  failed: 'ارسال ناموفق بود.',
}

function TemplateCard({ template }: { template: SmsTemplate }) {
  const queryClient = useQueryClient()
  const { confirm, Dialog } = useConfirmDialog()

  /**
   * Unsaved edits as an overlay on the server's copy, not state copied in by an
   * effect — the same reasoning as the content-pages screen: a background
   * refetch must never wipe what the admin is halfway through typing, and
   * "not edited" is then simply the absence of a draft.
   */
  const [draftBody, setDraftBody] = useState<string | null>(null)
  const [draftTemplateId, setDraftTemplateId] = useState<string | null>(null)
  const [testPhone, setTestPhone] = useState('')

  const body = draftBody ?? template.body ?? ''
  const providerTemplateId =
    draftTemplateId ??
    (template.providerTemplateId === null ? '' : String(template.providerTemplateId))
  const dirty = draftBody !== null || draftTemplateId !== null

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['admin', 'sms', 'templates'] })
  }

  const saveMutation = useMutation({
    mutationFn: () =>
      updateSmsTemplate(template.event, {
        ...(draftBody !== null ? { body: draftBody } : {}),
        ...(draftTemplateId !== null
          ? { providerTemplateId: draftTemplateId.trim() === '' ? null : Number(draftTemplateId) }
          : {}),
      }),
    onSuccess: () => {
      setDraftBody(null)
      setDraftTemplateId(null)
      invalidate()
      toast.success('تغییرات ذخیره شد')
    },
    onError: (error: Error) => toast.error(error.message),
  })

  // Separate from the save button: a switch that only took effect after
  // pressing «ذخیره» elsewhere on the card would read as broken.
  const toggleMutation = useMutation({
    mutationFn: (enabled: boolean) => updateSmsTemplate(template.event, { enabled }),
    onSuccess: (_result, enabled) => {
      invalidate()
      toast.success(enabled ? 'ارسال این پیامک فعال شد' : 'ارسال این پیامک خاموش شد')
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const testMutation = useMutation({
    mutationFn: () => sendTestSms(template.event, testPhone),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'sms', 'log'] })
      const message = OUTCOME_MESSAGES[result.outcome] ?? result.outcome
      if (result.outcome === 'sent') {
        toast.success(message)
      } else {
        toast.error(result.reason ? `${message} (${result.reason})` : message)
      }
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const runTest = async () => {
    if (testPhone.trim() === '') {
      toast.error('شماره موبایل را وارد کنید')
      return
    }
    // A test send reaches a real handset and spends real credit, so it is
    // confirmed rather than fired on a single click.
    const confirmed = await confirm({
      title: 'ارسال پیامک آزمایشی',
      description: `یک پیامک واقعی به ${testPhone} ارسال و از اعتبار سامانه کسر می‌شود.`,
      confirmText: 'ارسال کن',
    })
    if (confirmed) testMutation.mutate()
  }

  const locked = template.channel === 'VERIFY'

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-row items-start justify-between gap-4 border-b border-border/60">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2 text-base">
            {template.label}
            {locked ? (
              <Badge variant="secondary" className="gap-1">
                <Lock className="size-3" />
                قالب سامانه
              </Badge>
            ) : null}
          </CardTitle>
          <p className="text-sm leading-6 text-muted-foreground">{template.description}</p>
        </div>
        <label className="flex shrink-0 items-center gap-2 text-sm">
          <Switch
            checked={template.enabled}
            disabled={toggleMutation.isPending}
            onCheckedChange={(checked) => toggleMutation.mutate(checked)}
            aria-label={`ارسال پیامک ${template.label}`}
          />
          <span className="text-muted-foreground">{template.enabled ? 'فعال' : 'خاموش'}</span>
        </label>
      </CardHeader>

      <CardContent className="space-y-4 pt-4">
        {template.blockedReason ? (
          <Alert variant="warning" title="این پیامک در حال حاضر ارسال نمی‌شود">
            {template.blockedReason}
          </Alert>
        ) : null}

        {locked ? (
          <div className="space-y-4">
            <Alert variant="info">
              متن این پیامک در پنل SMS.ir ثبت می‌شود و از خط خدماتی ارسال می‌گردد؛ به همین دلیل
              به کاربرانی که تبلیغات پیامکی را مسدود کرده‌اند هم می‌رسد. تنها چیزی که اینجا لازم
              است، شناسه قالب است.
            </Alert>
            <FormField label="شناسه قالب در پنل SMS.ir" required>
              {(field) => (
                <Input
                  {...field}
                  inputMode="numeric"
                  value={providerTemplateId}
                  onChange={(changeEvent) => setDraftTemplateId(changeEvent.target.value)}
                  placeholder="مثلاً ۶۸۳۴۳۱"
                />
              )}
            </FormField>
          </div>
        ) : (
          <div className="space-y-3">
            <FormField label="متن پیامک" required>
              {(field) => (
                <Textarea
                  {...field}
                  rows={4}
                  value={body}
                  onChange={(changeEvent) => setDraftBody(changeEvent.target.value)}
                />
              )}
            </FormField>

            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-muted-foreground">متغیرهای قابل استفاده:</span>
              {template.variables.map((variable) => (
                <button
                  key={variable}
                  type="button"
                  onClick={() => setDraftBody(`${body}{{${variable}}}`)}
                  className="rounded-md border border-border bg-muted/40 px-2 py-1 font-mono tabular-nums transition-colors hover:border-primary hover:text-primary"
                  title={VARIABLE_LABELS[variable] ?? variable}
                >
                  {`{{${variable}}}`}
                </button>
              ))}
            </div>

            {template.preview ? (
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <p className="mb-1 text-xs text-muted-foreground">پیش‌نمایش با مقادیر نمونه:</p>
                <p className="whitespace-pre-wrap text-sm leading-7">{template.preview}</p>
              </div>
            ) : null}
          </div>
        )}

        <div className="flex flex-wrap items-end gap-3 border-t border-border/60 pt-4">
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={!dirty || saveMutation.isPending}
            loading={saveMutation.isPending}
          >
            ذخیره
          </Button>
          {dirty ? (
            <Button
              variant="ghost"
              onClick={() => {
                setDraftBody(null)
                setDraftTemplateId(null)
              }}
            >
              انصراف
            </Button>
          ) : null}

          <div className="ms-auto flex items-end gap-2">
            <FormField label="ارسال آزمایشی به" className="w-44">
              {(field) => (
                <Input
                  {...field}
                  inputMode="tel"
                  placeholder="۰۹۱۲۳۴۵۶۷۸۹"
                  value={testPhone}
                  onChange={(changeEvent) => setTestPhone(changeEvent.target.value)}
                />
              )}
            </FormField>
            <Button variant="outline" onClick={() => void runTest()} loading={testMutation.isPending}>
              <Send className="size-4" />
              ارسال
            </Button>
          </div>
        </div>
      </CardContent>
      <Dialog />
    </Card>
  )
}

function AccountStatus() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'sms', 'status'],
    queryFn: getSmsStatus,
    // Each call asks SMS.ir for the credit and the line list, so this does not
    // need to refetch every time the window regains focus.
    staleTime: 60_000,
  })

  if (isLoading) return <Skeleton className="h-24 w-full" />
  if (!data) return null

  if (!data.configured) {
    return (
      <Alert variant="warning" title="سامانه پیامک تنظیم نشده است">
        کلید وب‌سرویس SMS.ir روی سرور وارد نشده است. تا آن زمان متن پیامک‌ها فقط در گزارش ثبت
        می‌شود و چیزی برای مشتری ارسال نمی‌گردد.
      </Alert>
    )
  }

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <Card className="p-4">
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Wallet className="size-4" />
          اعتبار باقی‌مانده
        </p>
        <p className="mt-1 text-lg font-semibold tabular-nums">
          {data.credit === null ? '—' : data.credit.toLocaleString('fa-IR')}
        </p>
      </Card>
      <Card className="p-4">
        <p className="text-xs text-muted-foreground">خط ارسال متن آزاد</p>
        <p className="mt-1 text-lg font-semibold tabular-nums">{data.lineNumber ?? 'تنظیم نشده'}</p>
      </Card>
      <Card className="p-4">
        <p className="text-xs text-muted-foreground">خطوط موجود در پنل</p>
        <p className="mt-1 text-sm leading-7 tabular-nums">
          {data.lines && data.lines.length > 0 ? data.lines.join('، ') : '—'}
        </p>
      </Card>
      {data.error ? (
        <Alert variant="error" title="خواندن وضعیت سامانه ناموفق بود" className="sm:col-span-3">
          {data.error}
        </Alert>
      ) : null}
    </div>
  )
}

function DeliveryLog({ templates }: { templates: SmsTemplate[] }) {
  const [page, setPage] = useState(1)
  const [event, setEvent] = useState('')
  const [status, setStatus] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'sms', 'log', page, event, status],
    queryFn: () =>
      getSmsLog({ page, limit: 20, event: event || undefined, status: status || undefined }),
  })

  const columns: DataTableColumn<SmsLogRow>[] = [
    {
      id: 'createdAt',
      header: 'زمان',
      cell: (row) => new Date(row.createdAt).toLocaleString('fa-IR'),
      numeric: true,
      width: '12rem',
    },
    {
      id: 'event',
      header: 'رویداد',
      cell: (row) =>
        templates.find((template) => template.event === row.event)?.label ?? row.event ?? '—',
    },
    { id: 'phone', header: 'شماره', cell: (row) => row.phone, numeric: true },
    {
      id: 'status',
      header: 'وضعیت',
      cell: (row) => {
        const meta = STATUS_LABELS[row.status]
        return <Badge variant={meta.variant}>{meta.label}</Badge>
      },
      align: 'center',
      width: '8rem',
    },
    {
      id: 'message',
      header: 'متن',
      cell: (row) => (
        <span className="line-clamp-2 text-sm leading-6">
          {row.message}
          {row.reason ? <span className="block text-xs text-danger">{row.reason}</span> : null}
        </span>
      ),
      hideBelow: 'md',
    },
  ]

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        <Select
          value={event || 'all'}
          onValueChange={(value) => {
            setEvent(value === 'all' ? '' : value)
            setPage(1)
          }}
        >
          <SelectTrigger className="w-56">
            <SelectValue placeholder="همه رویدادها" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">همه رویدادها</SelectItem>
            {templates.map((template) => (
              <SelectItem key={template.event} value={template.event}>
                {template.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={status || 'all'}
          onValueChange={(value) => {
            setStatus(value === 'all' ? '' : value)
            setPage(1)
          }}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="همه وضعیت‌ها" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">همه وضعیت‌ها</SelectItem>
            <SelectItem value="SENT">ارسال شده</SelectItem>
            <SelectItem value="FAILED">ناموفق</SelectItem>
            <SelectItem value="PENDING">در انتظار</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <DataTable
        columns={columns}
        rows={data?.rows ?? []}
        getRowId={(row) => row.id}
        isLoading={isLoading}
        caption="گزارش پیامک‌های ارسال شده"
        emptyMessage="هنوز پیامکی ارسال نشده است."
        emptyIcon={<MessageSquare className="size-8" />}
        pagination={{
          page,
          pageSize: data?.meta.limit ?? 20,
          total: data?.meta.total,
          totalPages: data?.meta.totalPages,
          onPageChange: setPage,
        }}
      />
    </div>
  )
}

export function AdminSmsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'sms', 'templates'],
    queryFn: getSmsTemplates,
  })

  const templates = data?.templates ?? []

  return (
    <div className="space-y-6">
      <PageHeader
        title="پیامک‌ها"
        description="انتخاب کنید کدام رویدادها برای مشتری پیامک بفرستند و متن هر پیامک چه باشد."
      />

      <AccountStatus />

      <Tabs defaultValue="templates">
        <TabsList>
          <TabsTrigger value="templates">متن و رویدادها</TabsTrigger>
          <TabsTrigger value="log">گزارش ارسال</TabsTrigger>
        </TabsList>

        <TabsContent value="templates" className="space-y-4">
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-56 w-full" />
              <Skeleton className="h-56 w-full" />
            </div>
          ) : (
            templates.map((template) => (
              <ScrollReveal key={template.event}>
                <TemplateCard template={template} />
              </ScrollReveal>
            ))
          )}
        </TabsContent>

        <TabsContent value="log">
          <DeliveryLog templates={templates} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
