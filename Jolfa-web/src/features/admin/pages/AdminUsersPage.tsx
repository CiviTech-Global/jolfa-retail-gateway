import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Search, UserCog, Power, KeyRound, Users } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
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

export function AdminUsersPage() {
  const queryClient = useQueryClient()
  const { confirm, Dialog } = useConfirmDialog()
  const [page, setPage] = useState(1)
  const [q, setQ] = useState('')
  const [resetTarget, setResetTarget] = useState<AdminUserDto | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'users', page, q],
    queryFn: () => getAdminUsers(page, 20, q),
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

      <div className="relative">
        <Search className="absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="جستجو بر اساس نام، موبایل یا ایمیل..."
          value={q}
          onChange={(e) => { setQ(e.target.value); setPage(1) }}
          className="pe-9"
        />
      </div>

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
