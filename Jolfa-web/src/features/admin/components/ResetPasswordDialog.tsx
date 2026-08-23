import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Copy, RefreshCw, ShieldAlert } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
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
import type { AdminUserDto } from '@/features/admin/types'

/** Readable random password an admin can dictate over the phone. */
function suggestPassword(): string {
  const alphabet = 'abcdefghijkmnopqrstuvwxyzACDEFGHJKLMNPQRSTUVWXYZ23456789'
  const values = new Uint32Array(12)
  crypto.getRandomValues(values)
  return Array.from(values, (value) => alphabet[value % alphabet.length]).join('')
}

export function ResetPasswordDialog({
  user,
  onClose,
  onSubmit,
}: {
  user: AdminUserDto | null
  onClose: () => void
  onSubmit: (id: string, newPassword: string) => Promise<unknown>
}) {
  return (
    <Dialog
      open={user !== null}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent size="sm">
        {/* Remount per user so a fresh suggested password is generated in the
            state initializer rather than synced in via an effect. */}
        {user && (
          <ResetPasswordForm key={user.id} user={user} onClose={onClose} onSubmit={onSubmit} />
        )}
      </DialogContent>
    </Dialog>
  )
}

function ResetPasswordForm({
  user,
  onClose,
  onSubmit,
}: {
  user: AdminUserDto
  onClose: () => void
  onSubmit: (id: string, newPassword: string) => Promise<unknown>
}) {
  const [password, setPassword] = useState(suggestPassword)
  const [error, setError] = useState<string>()

  const mutation = useMutation({
    mutationFn: () => onSubmit(user.id, password),
    onSuccess: () => {
      toast.success('رمز عبور کاربر تغییر کرد')
      onClose()
    },
    onError: (mutationError: unknown) => {
      setError(
        mutationError instanceof Error ? mutationError.message : 'تغییر رمز عبور ناموفق بود',
      )
    },
  })

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    if (password.trim().length < 6) {
      setError('رمز عبور باید حداقل ۶ کاراکتر باشد')
      return
    }
    setError(undefined)
    mutation.mutate()
  }

  const displayName =
    `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim() || user?.phone || 'کاربر'

  return (
    <>
        <DialogHeader>
          <DialogTitle>تغییر رمز عبور</DialogTitle>
          <DialogDescription>
            رمز عبور جدید برای «{displayName}» تعیین کنید و آن را به کاربر اطلاع دهید.
          </DialogDescription>
        </DialogHeader>

        <DialogForm onSubmit={submit}>
          <DialogBody className="space-y-4">
            <FormField label="رمز عبور جدید" required error={error} hint="حداقل ۶ کاراکتر">
              {(field) => (
                <div className="flex gap-2">
                  <Input
                    {...field}
                    value={password}
                    dir="ltr"
                    onChange={(event) => setPassword(event.target.value)}
                    className="font-mono"
                    autoComplete="new-password"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setPassword(suggestPassword())}
                    aria-label="ساخت رمز تصادفی"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      navigator.clipboard
                        .writeText(password)
                        .then(() => toast.success('رمز عبور کپی شد'))
                        .catch(() => toast.error('کپی نشد؛ به‌صورت دستی کپی کنید'))
                    }}
                    aria-label="کپی رمز عبور"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </FormField>

            <p className="flex items-start gap-2 rounded-xl bg-warning-soft p-3 text-sm text-foreground">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                این رمز فقط همین حالا نمایش داده می‌شود. کاربر با پیامک از تغییر مطلع می‌شود و
                بهتر است پس از ورود آن را عوض کند.
              </span>
            </p>
          </DialogBody>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              انصراف
            </Button>
            <Button type="submit" loading={mutation.isPending}>
              تغییر رمز عبور
            </Button>
          </DialogFooter>
        </DialogForm>
    </>
  )
}
