import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { AlertTriangle, Calculator, Check } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { FormField } from '@/components/ui/FormField'
import { Switch } from '@/components/ui/Switch'
import { DataTable } from '@/components/ui/DataTable'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select'
import { ScrollReveal } from '@/components/motion/ScrollReveal'
import { useConfirmDialog } from '@/hooks/useConfirmDialog'
import { formatNumber, formatPrice } from '@/lib/utils'
import { getCategories } from '@/features/catalog/api'
import type { CategoryTreeDto } from '@/features/catalog/types'
import { bulkAdjustPrices, type BulkPriceBody, type BulkPriceResult } from './api'

const ALL_PRODUCTS = '__all__'

/**
 * Bulk price changes.
 *
 * The most destructive screen in the panel: one click can rewrite every price
 * in the shop, and there is no per-product undo. The flow is therefore always
 * preview first — the apply button does not exist until a preview has been run,
 * and changing any input throws the preview away so it can never be applied to
 * settings the admin has since edited.
 */
export function AdminBulkPricingPage() {
  const queryClient = useQueryClient()
  const { confirm, Dialog } = useConfirmDialog()

  const [scopeId, setScopeId] = useState<string>(ALL_PRODUCTS)
  const [mode, setMode] = useState<'percent' | 'fixed'>('percent')
  const [direction, setDirection] = useState<'increase' | 'decrease'>('decrease')
  const [value, setValue] = useState('10')
  const [roundTo, setRoundTo] = useState('1000')
  const [setCompareAtPrice, setSetCompareAtPrice] = useState(true)
  const [preview, setPreview] = useState<BulkPriceResult | null>(null)

  const { data: categoryData } = useQuery({
    queryKey: ['categories', 'tree'],
    queryFn: () => getCategories(true),
  })
  const tree = (categoryData?.categories ?? []) as CategoryTreeDto[]

  /** Any edit invalidates the preview: applying a stale one is the whole risk. */
  const change = <T,>(setter: (next: T) => void) => (next: T) => {
    setPreview(null)
    setter(next)
  }

  const buildBody = (dryRun: boolean): BulkPriceBody => ({
    scope: scopeId === ALL_PRODUCTS ? { kind: 'all' } : { kind: 'category', categoryId: scopeId },
    mode,
    direction,
    value: Number(value),
    roundTo: roundTo ? Number(roundTo) : undefined,
    setCompareAtPrice: direction === 'decrease' && setCompareAtPrice,
    clearCompareAtPrice: direction === 'increase',
    dryRun,
  })

  const previewMutation = useMutation({
    mutationFn: () => bulkAdjustPrices(buildBody(true)),
    onSuccess: setPreview,
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : 'محاسبه پیش‌نمایش ناموفق بود'),
  })

  const applyMutation = useMutation({
    mutationFn: () => bulkAdjustPrices(buildBody(false)),
    onSuccess: (result) => {
      setPreview(null)
      void queryClient.invalidateQueries({ queryKey: ['admin', 'products'] })
      void queryClient.invalidateQueries({ queryKey: ['products'] })
      toast.success(`قیمت ${formatNumber(result.changed)} محصول به‌روزرسانی شد`)
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : 'اعمال تغییر قیمت ناموفق بود'),
  })

  const scopeLabel =
    scopeId === ALL_PRODUCTS
      ? 'همه محصولات فروشگاه'
      : (tree.flatMap((p) => [p, ...(p.children ?? [])]).find((c) => c.id === scopeId)?.name ??
        'دسته‌بندی انتخاب‌شده')

  const apply = async () => {
    if (!preview) return
    const ok = await confirm({
      title: 'اعمال تغییر قیمت',
      description: `قیمت ${formatNumber(preview.changed)} محصول در «${scopeLabel}» تغییر می‌کند. این عملیات قابل بازگشت خودکار نیست.`,
      confirmText: 'اعمال تغییر',
      cancelText: 'انصراف',
      variant: 'danger',
    })
    if (ok) applyMutation.mutate()
  }

  const numericValue = Number(value)
  const valueInvalid =
    !Number.isFinite(numericValue) ||
    numericValue <= 0 ||
    (mode === 'percent' && numericValue > 95)

  return (
    <ScrollReveal className="space-y-6">
      <PageHeader
        title="تغییر گروهی قیمت"
        description="اعمال تخفیف یا افزایش قیمت روی یک دسته‌بندی یا کل فروشگاه، با پیش‌نمایش پیش از ثبت."
      />

      <Card>
        <CardHeader>
          <CardTitle>تنظیم تغییر</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <FormField label="محدوده" hint="انتخاب دسته‌بندی اصلی، زیردسته‌های آن را هم شامل می‌شود.">
            {(field) => (
              <Select value={scopeId} onValueChange={change(setScopeId)}>
                <SelectTrigger id={field.id}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_PRODUCTS}>همه محصولات فروشگاه</SelectItem>
                  {tree.map((parent) => [
                    <SelectItem key={parent.id} value={parent.id}>
                      {parent.name}
                    </SelectItem>,
                    ...(parent.children ?? []).map((child) => (
                      <SelectItem key={child.id} value={child.id}>
                        {`${parent.name} › ${child.name}`}
                      </SelectItem>
                    )),
                  ])}
                </SelectContent>
              </Select>
            )}
          </FormField>

          <FormField label="جهت تغییر">
            {(field) => (
              <Select
                value={direction}
                onValueChange={change((next: string) =>
                  setDirection(next as 'increase' | 'decrease'),
                )}
              >
                <SelectTrigger id={field.id}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="decrease">کاهش (تخفیف)</SelectItem>
                  <SelectItem value="increase">افزایش</SelectItem>
                </SelectContent>
              </Select>
            )}
          </FormField>

          <FormField label="نوع تغییر">
            {(field) => (
              <Select
                value={mode}
                onValueChange={change((next: string) => setMode(next as 'percent' | 'fixed'))}
              >
                <SelectTrigger id={field.id}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percent">درصدی</SelectItem>
                  <SelectItem value="fixed">مبلغ ثابت (تومان)</SelectItem>
                </SelectContent>
              </Select>
            )}
          </FormField>

          <FormField
            label={mode === 'percent' ? 'درصد' : 'مبلغ (تومان)'}
            required
            error={
              valueInvalid
                ? mode === 'percent'
                  ? 'درصد باید بین ۱ تا ۹۵ باشد'
                  : 'مبلغ باید بیشتر از صفر باشد'
                : undefined
            }
          >
            {(field) => (
              <Input
                {...field}
                inputMode="numeric"
                dir="ltr"
                value={value}
                onChange={(event) => change(setValue)(event.target.value)}
              />
            )}
          </FormField>

          <FormField label="گرد کردن به" hint="مثلاً ۱۰۰۰ تومان، تا قیمت‌ها رند بمانند.">
            {(field) => (
              <Input
                {...field}
                inputMode="numeric"
                dir="ltr"
                value={roundTo}
                onChange={(event) => change(setRoundTo)(event.target.value)}
              />
            )}
          </FormField>

          {direction === 'decrease' && (
            <FormField label="ثبت قیمت قبلی به‌عنوان قیمت خط‌خورده">
              {() => (
                <Switch
                  checked={setCompareAtPrice}
                  onCheckedChange={change(setSetCompareAtPrice)}
                  aria-label="ثبت قیمت قبلی"
                />
              )}
            </FormField>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          onClick={() => previewMutation.mutate()}
          loading={previewMutation.isPending}
          disabled={valueInvalid}
        >
          <Calculator className="h-4 w-4" />
          محاسبه پیش‌نمایش
        </Button>
        {preview && (
          <Button variant="danger" onClick={() => void apply()} loading={applyMutation.isPending}>
            <Check className="h-4 w-4" />
            اعمال روی {formatNumber(preview.changed)} محصول
          </Button>
        )}
      </div>

      {preview && (
        <Card>
          <CardHeader>
            <CardTitle>پیش‌نمایش</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Stat label="محصولات در محدوده" value={formatNumber(preview.matched)} />
              <Stat label="تغییر می‌کنند" value={formatNumber(preview.changed)} />
              <Stat label="جمع قیمت فعلی" value={formatPrice(preview.totalBefore)} />
              <Stat label="جمع قیمت جدید" value={formatPrice(preview.totalAfter)} />
            </div>

            {preview.clamped > 0 && (
              <p className="flex items-start gap-2 rounded-xl border border-warning/40 bg-warning-soft p-3 text-sm text-warning">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>
                  {formatNumber(preview.clamped)} محصول به کف قیمت (۱٬۰۰۰ تومان) رسیده و پایین‌تر
                  نمی‌رود.
                </span>
              </p>
            )}

            {preview.changed === 0 ? (
              <p className="rounded-xl border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
                با این تنظیمات قیمت هیچ محصولی تغییر نمی‌کند.
              </p>
            ) : (
              <>
                <DataTable
                  caption="نمونه تغییرات قیمت"
                  rows={preview.sample}
                  getRowId={(row) => row.id}
                  disableInternalPagination
                  columns={[
                    { id: 'title', header: 'محصول', cell: (row) => row.title },
                    {
                      id: 'before',
                      header: 'قیمت فعلی',
                      numeric: true,
                      cell: (row) => formatPrice(row.before),
                    },
                    {
                      id: 'after',
                      header: 'قیمت جدید',
                      numeric: true,
                      cell: (row) => (
                        <span
                          className={
                            row.after < row.before ? 'text-success' : 'text-warning'
                          }
                        >
                          {formatPrice(row.after)}
                        </span>
                      ),
                    },
                  ]}
                />
                {preview.changed > preview.sample.length && (
                  <p className="text-xs text-muted-foreground">
                    نمایش {formatNumber(preview.sample.length)} مورد از{' '}
                    {formatNumber(preview.changed)} تغییر.
                  </p>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog />
    </ScrollReveal>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold tabular-nums text-foreground">{value}</p>
    </div>
  )
}
