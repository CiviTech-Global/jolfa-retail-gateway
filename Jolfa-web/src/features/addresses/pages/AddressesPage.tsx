import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { MapPin, Pencil, Plus, Star, Trash2, TriangleAlert, User, Phone } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Card, CardContent } from '@/components/ui/Card'
import { PageHeader } from '@/components/layout/Breadcrumbs'
import { Seo } from '@/components/seo/Seo'
import { ScrollReveal } from '@/components/motion/ScrollReveal'
import { useConfirmDialog } from '@/hooks/useConfirmDialog'
import {
  ADDRESSES_QUERY_KEY,
  deleteAddress,
  getAddresses,
  setDefaultAddress,
} from '../api'
import { findAddressProblems, formatAddressLine } from '../schema'
import { AddressFormDialog } from '../components/AddressFormDialog'
import type { AddressDto } from '../types'

function AddressCard({
  address,
  onEdit,
  onDelete,
  onMakeDefault,
  isBusy,
}: {
  address: AddressDto
  onEdit: () => void
  onDelete: () => void
  onMakeDefault: () => void
  isBusy: boolean
}) {
  const problems = findAddressProblems(address)

  return (
    <Card
      className={
        problems.length > 0 ? 'border-danger/60' : address.isDefault ? 'border-primary' : undefined
      }
    >
      <CardContent className="space-y-3 py-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
              <MapPin className="h-4 w-4" />
            </span>
            <p className="truncate font-medium text-foreground">
              {address.title || 'بدون عنوان'}
            </p>
          </div>
          {address.isDefault && <Badge variant="success">پیش‌فرض</Badge>}
        </div>

        <p className="text-sm leading-7 text-muted-foreground">{formatAddressLine(address)}</p>

        <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <User className="h-3.5 w-3.5" />
            {address.recipientName}
          </span>
          <span className="flex items-center gap-1.5" dir="ltr">
            <Phone className="h-3.5 w-3.5" />
            {address.phone}
          </span>
          {address.postalCode && (
            <span dir="ltr">کد پستی: {address.postalCode}</span>
          )}
        </div>

        {problems.length > 0 && (
          <div className="rounded-lg border border-danger/30 bg-danger-soft/60 p-3 text-sm">
            <p className="flex items-center gap-1.5 font-medium text-danger">
              <TriangleAlert className="h-4 w-4 shrink-0" />
              تا این موارد تکمیل نشود، نمی‌توان با این آدرس خرید کرد:
            </p>
            <ul className="mt-2 list-disc space-y-1 ps-6 text-foreground">
              {problems.map((problem) => (
                <li key={problem.field}>{problem.message}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex flex-wrap gap-2 border-t border-border pt-3">
          {!address.isDefault && (
            <Button size="sm" variant="outline" onClick={onMakeDefault} disabled={isBusy}>
              <Star className="h-4 w-4" />
              <span className="ms-1">پیش‌فرض کن</span>
            </Button>
          )}
          <Button
            size="sm"
            variant={problems.length > 0 ? 'solid' : 'outline'}
            onClick={onEdit}
            disabled={isBusy}
          >
            <Pencil className="h-4 w-4" />
            <span className="ms-1">{problems.length > 0 ? 'تکمیل آدرس' : 'ویرایش'}</span>
          </Button>
          <Button size="sm" variant="ghost" onClick={onDelete} disabled={isBusy}>
            <Trash2 className="h-4 w-4 text-danger" />
            <span className="ms-1 text-danger">حذف</span>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export function AddressesPage() {
  const queryClient = useQueryClient()
  const { confirm, Dialog: ConfirmDialogComponent } = useConfirmDialog()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<AddressDto>()

  const { data, isLoading } = useQuery({
    queryKey: ADDRESSES_QUERY_KEY,
    queryFn: getAddresses,
  })

  const addresses = data?.addresses ?? []

  // Arriving from checkout's "complete this address" link: open that entry
  // straight away, and go back to checkout once it is saved.
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const editId = searchParams.get('edit')
  const returnToCheckout = searchParams.get('from') === 'checkout'

  const linkedAddress = editId ? addresses.find((address) => address.id === editId) : undefined
  const dialogAddress = linkedAddress ?? editing
  const isDialogOpen = dialogOpen || Boolean(linkedAddress)

  const handleDialogChange = (open: boolean) => {
    setDialogOpen(open)
    // Closing without saving leaves the page as a plain address book.
    if (!open && editId) setSearchParams({}, { replace: true })
  }

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ADDRESSES_QUERY_KEY })
  }

  const defaultMutation = useMutation({
    mutationFn: setDefaultAddress,
    onSuccess: () => {
      invalidate()
      toast.success('آدرس پیش‌فرض تغییر کرد')
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : 'تغییر آدرس پیش‌فرض ناموفق بود')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: deleteAddress,
    onSuccess: () => {
      invalidate()
      toast.success('آدرس حذف شد')
    },
    onError: (error: unknown) => {
      // The server refuses to delete an address an order still points at.
      toast.error(error instanceof Error ? error.message : 'حذف آدرس ناموفق بود')
    },
  })

  const isBusy = defaultMutation.isPending || deleteMutation.isPending

  const handleDelete = async (address: AddressDto) => {
    const confirmed = await confirm({
      title: 'حذف آدرس',
      description: `آیا «${address.title || address.recipientName}» حذف شود؟ این کار قابل بازگشت نیست.`,
      confirmText: 'حذف',
      variant: 'danger',
    })
    if (confirmed) {
      deleteMutation.mutate(address.id)
    }
  }

  return (
    <div>
      <Seo title="آدرس‌های من" />
      <ScrollReveal>
        <PageHeader
          title="آدرس‌های من"
          description="آدرس‌های خود را مدیریت کنید تا هنگام تسویه حساب سریع‌تر سفارش ثبت کنید."
          backTo="/profile"
          breadcrumbs={[{ label: 'پنل کاربری', to: '/profile' }, { label: 'آدرس‌های من' }]}
          actions={
            <Button
              onClick={() => {
                setEditing(undefined)
                setDialogOpen(true)
              }}
            >
              <Plus className="h-4 w-4" />
              <span className="ms-1">افزودن آدرس</span>
            </Button>
          }
        />
      </ScrollReveal>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-56 animate-pulse rounded-2xl bg-muted" />
          ))}
        </div>
      ) : addresses.length === 0 ? (
        <Card className="py-16 text-center">
          <CardContent>
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-soft text-primary">
              <MapPin className="h-6 w-6" />
            </span>
            <p className="mt-4 font-medium text-foreground">هنوز آدرسی ثبت نکرده‌اید</p>
            <p className="mt-1 text-sm text-muted-foreground">
              با ذخیره آدرس، در سفارش‌های بعدی نیازی به وارد کردن دوباره آن ندارید.
            </p>
            <Button
              className="mt-6"
              onClick={() => {
                setEditing(undefined)
                setDialogOpen(true)
              }}
            >
              <Plus className="h-4 w-4" />
              <span className="ms-1">افزودن اولین آدرس</span>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {addresses.map((address) => (
            <ScrollReveal key={address.id}>
              <AddressCard
                address={address}
                isBusy={isBusy}
                onEdit={() => {
                  setEditing(address)
                  setDialogOpen(true)
                }}
                onDelete={() => void handleDelete(address)}
                onMakeDefault={() => defaultMutation.mutate(address.id)}
              />
            </ScrollReveal>
          ))}
        </div>
      )}

      <AddressFormDialog
        open={isDialogOpen}
        onOpenChange={handleDialogChange}
        address={dialogAddress}
        onSaved={returnToCheckout ? () => void navigate('/checkout') : undefined}
      />
      <ConfirmDialogComponent />
    </div>
  )
}
