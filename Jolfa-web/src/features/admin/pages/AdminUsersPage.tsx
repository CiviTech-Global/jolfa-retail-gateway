import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { UserCog, Power, KeyRound, Users } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { DebouncedSearchInput, FilterBar, FilterField } from '@/components/ui/FilterBar'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select'
import { Badge } from '@/components/ui/Badge'
import { DataTable } from '@/components/ui/DataTable'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { ScrollReveal } from '@/components/motion/ScrollReveal'
import { PageHeader } from '@/components/layout/Breadcrumbs'
import { useConfirmDialog } from '@/hooks/useConfirmDialog'
import { ResetPasswordDialog } from '../components/ResetPasswordDialog'
import { getAdminUsers, resetUserPassword, updateUserRole, updateUserStatus } from '@/features/admin/api'
import type { AdminUserDto } from '@/features/admin/types'

const PAGE_SIZE = 20
const ANY = '__any__'

export function AdminUsersPage() {
  const queryClient = useQueryClient()
  const { confirm, Dialog } = useConfirmDialog()
  const [page, setPage] = useState(1)
  const [q, setQ] = useState('')
  // These two have been supported by the API since it was written and were
  // never exposed, so finding "all the admins" meant paging through everyone.
  const [role, setRole] = useState(ANY)
  const [status, setStatus] = useState(ANY)

  const applyFilter = <T,>(setter: (next: T) => void) => (next: T) => {
    setPage(1)
    setter(next)
  }

  const activeFilterCount = [q !== '', role !== ANY, status !== ANY].filter(Boolean).length

  const clearFilters = () => {
    setPage(1)
    setQ('')
    setRole(ANY)
    setStatus(ANY)
  }
  const [resetTarget, setResetTarget] = useState<AdminUserDto | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'users', page, q, role, status],
    queryFn: () =>
      getAdminUsers(
        page,
        PAGE_SIZE,
        q || undefined,
        role === ANY ? undefined : role,
        status === ANY ? undefined : status === 'active',
      ),
  })

  const roleMutation = useMutation({
    mutationFn: ({ id, role }: { id: string; role: 'CUSTOMER' | 'ADMIN' }) => updateUserRole(id, role),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
      toast.success('نقش کاربر تغییر کرد')
    },
  })

  const statusMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => updateUserStatus(id, isActive),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
      toast.success('وضعیت کاربر تغییر کرد')
    },
  })

  async function handleRoleToggle(user: AdminUserDto) {
    const nextRole = user.role === 'ADMIN' ? 'CUSTOMER' : 'ADMIN'
    const ok = await confirm({
      title: 'تغییر نقش کاربر',
      description: `آیا می‌خواهید نقش این کاربر را به «${nextRole === 'ADMIN' ? 'مدیر' : 'مشتری'}» تغییر دهید؟`,
      confirmText: 'تأیید',
      cancelText: 'انصراف',
      variant: 'primary',
    })
    if (ok) roleMutation.mutate({ id: user.id, role: nextRole })
  }

  async function handleStatusToggle(user: AdminUserDto) {
    const nextActive = !user.isActive
    const ok = await confirm({
      title: nextActive ? 'فعال‌سازی کاربر' : 'غیرفعال‌سازی کاربر',
      description: `آیا مطمئنید که می‌خواهید این کاربر را ${nextActive ? 'فعال' : 'غیرفعال'} کنید؟`,
      confirmText: 'تأیید',
      cancelText: 'انصراف',
      variant: nextActive ? 'primary' : 'danger',
    })
    if (ok) statusMutation.mutate({ id: user.id, isActive: nextActive })
  }

  const users = data?.users ?? []

  return (
    <ScrollReveal className="space-y-6">
      <PageHeader
        title="مدیریت کاربران"
        description="نقش، وضعیت و رمز عبور کاربران را مدیریت کنید."
      />

      <FilterBar activeCount={activeFilterCount} onClear={clearFilters}>
        <FilterField label="جستجو" className="min-w-[16rem] flex-1">
          <DebouncedSearchInput
            value={q}
            onChange={applyFilter(setQ)}
            placeholder="نام، موبایل یا ایمیل ..."
          />
        </FilterField>

        <FilterField label="نقش">
          <Select value={role} onValueChange={applyFilter(setRole)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>همه</SelectItem>
              <SelectItem value="ADMIN">مدیر</SelectItem>
              <SelectItem value="CUSTOMER">مشتری</SelectItem>
            </SelectContent>
          </Select>
        </FilterField>

        <FilterField label="وضعیت">
          <Select value={status} onValueChange={applyFilter(setStatus)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>همه</SelectItem>
              <SelectItem value="active">فعال</SelectItem>
              <SelectItem value="inactive">غیرفعال</SelectItem>
            </SelectContent>
          </Select>
        </FilterField>
      </FilterBar>

      <Card>
        <CardHeader>
          <CardTitle>لیست کاربران</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            caption="فهرست کاربران"
            rows={users}
            getRowId={(user: AdminUserDto) => user.id}
            isLoading={isLoading}
            emptyMessage="کاربری یافت نشد."
            emptyIcon={<Users className="h-6 w-6" aria-hidden="true" />}
            pagination={{
              page,
              pageSize: PAGE_SIZE,
              total: data?.meta.total,
              totalPages: data?.meta.totalPages,
              onPageChange: setPage,
            }}
            columns={[
              {
                id: 'name',
                header: 'نام',
                cell: (user: AdminUserDto) => (
                  <span className="font-medium text-foreground">
                    {`${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || '—'}
                  </span>
                ),
              },
              {
                id: 'phone',
                header: 'موبایل',
                cell: (user: AdminUserDto) => (
                  <span className="ltr-text tabular-nums text-muted-foreground">{user.phone}</span>
                ),
              },
              {
                id: 'role',
                header: 'نقش',
                align: 'center',
                cell: (user: AdminUserDto) => (
                  <Badge variant={user.role === 'ADMIN' ? 'default' : 'secondary'}>
                    {user.role === 'ADMIN' ? 'مدیر' : 'مشتری'}
                  </Badge>
                ),
              },
              {
                id: 'status',
                header: 'وضعیت',
                align: 'center',
                cell: (user: AdminUserDto) => (
                  <Badge variant={user.isActive ? 'success' : 'danger'}>
                    {user.isActive ? 'فعال' : 'غیرفعال'}
                  </Badge>
                ),
              },
              {
                id: 'actions',
                header: 'عملیات',
                align: 'end',
                cell: (user: AdminUserDto) => (
                  <div className="flex flex-wrap justify-end gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      loading={roleMutation.isPending}
                      onClick={() => handleRoleToggle(user)}
                    >
                      <UserCog className="h-4 w-4" />
                      {user.role === 'ADMIN' ? 'مشتری کردن' : 'مدیر کردن'}
                    </Button>
                    <Button
                      size="sm"
                      variant={user.isActive ? 'danger' : 'solid'}
                      loading={statusMutation.isPending}
                      onClick={() => handleStatusToggle(user)}
                    >
                      <Power className="h-4 w-4" />
                      {user.isActive ? 'غیرفعال کردن' : 'فعال کردن'}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setResetTarget(user)}>
                      <KeyRound className="h-4 w-4" />
                      رمز عبور
                    </Button>
                  </div>
                ),
              },
            ]}
          />
        </CardContent>
      </Card>

      <Dialog />

      <ResetPasswordDialog
        user={resetTarget}
        onClose={() => setResetTarget(null)}
        onSubmit={(id, password) => resetUserPassword(id, password)}
      />
    </ScrollReveal>
  )
}
