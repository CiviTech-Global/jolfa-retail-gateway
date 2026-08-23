import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Search, UserCog, Power, KeyRound } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { ScrollReveal } from '@/components/motion/ScrollReveal'
import { PageHeader } from '@/components/layout/Breadcrumbs'
import { useConfirmDialog } from '@/hooks/useConfirmDialog'
import { ResetPasswordDialog } from '../components/ResetPasswordDialog'
import { getAdminUsers, resetUserPassword, updateUserRole, updateUserStatus } from '@/features/admin/api'
import type { AdminUserDto } from '@/features/admin/types'

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
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">نام</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">موبایل</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">نقش</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">وضعیت</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">عملیات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isLoading ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">در حال بارگذاری ...</td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">کاربری یافت نشد.</td>
                  </tr>
                ) : (
                  users.map((user: AdminUserDto) => (
                    <tr key={user.id}>
                      <td className="px-4 py-3 font-medium text-foreground">
                        {`${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || '—'}
                      </td>
                      <td className="px-4 py-3 text-foreground">{user.phone}</td>
                      <td className="px-4 py-3">
                        <Badge variant={user.role === 'ADMIN' ? 'default' : 'secondary'}>{user.role === 'ADMIN' ? 'مدیر' : 'مشتری'}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={user.isActive ? 'success' : 'danger'}>{user.isActive ? 'فعال' : 'غیرفعال'}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
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
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setResetTarget(user)}
                          >
                            <KeyRound className="h-4 w-4" />
                            رمز عبور
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {data && data.meta.totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 border-t border-border p-4">
              <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>قبلی</Button>
              <span className="text-sm text-foreground">صفحه {page} از {data.meta.totalPages}</span>
              <Button size="sm" variant="outline" disabled={page >= data.meta.totalPages} onClick={() => setPage((p) => p + 1)}>بعدی</Button>
            </div>
          )}
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
