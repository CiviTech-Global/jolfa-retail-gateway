import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Database, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { ScrollReveal } from '@/components/motion/ScrollReveal'
import { useConfirmDialog } from '@/hooks/useConfirmDialog'
import { runDemoAction } from '../api'

export function AdminDemoDataPage() {
  const queryClient = useQueryClient()
  const { confirm, Dialog } = useConfirmDialog()

  const seedMutation = useMutation({
    mutationFn: () => runDemoAction({ action: 'seed' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['products'] })
      void queryClient.invalidateQueries({ queryKey: ['categories'] })
      void queryClient.invalidateQueries({ queryKey: ['homepage-sections'] })
      void queryClient.invalidateQueries({ queryKey: ['settings'] })
      void queryClient.invalidateQueries({ queryKey: ['admin', 'orders'] })
      void queryClient.invalidateQueries({ queryKey: ['admin', 'dashboard'] })
      toast.success('داده‌های نمونه ایجاد شدند')
    },
  })

  const clearMutation = useMutation({
    mutationFn: () => runDemoAction({ action: 'clear' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['products'] })
      void queryClient.invalidateQueries({ queryKey: ['categories'] })
      void queryClient.invalidateQueries({ queryKey: ['homepage-sections'] })
      void queryClient.invalidateQueries({ queryKey: ['settings'] })
      void queryClient.invalidateQueries({ queryKey: ['admin', 'orders'] })
      void queryClient.invalidateQueries({ queryKey: ['admin', 'dashboard'] })
      toast.success('داده‌های نمونه حذف شدند')
    },
  })

  async function handleSeed() {
    const ok = await confirm({
      title: 'ایجاد داده‌های نمونه',
      description: 'این عملیات داده‌های نمونه جدیدی به فروشگاه اضافه می‌کند. ادامه می‌دهید؟',
      confirmText: 'ایجاد',
      cancelText: 'انصراف',
      variant: 'primary',
    })
    if (ok) seedMutation.mutate()
  }

  async function handleClear() {
    const ok = await confirm({
      title: 'حذف داده‌های نمونه',
      description: 'تمامی داده‌های نمونه شامل محصولات، دسته‌بندی‌ها و تنظیمات پیش‌فرض حذف خواهند شد. این عملیات قابل بازگشت نیست.',
      confirmText: 'حذف',
      cancelText: 'انصراف',
      variant: 'danger',
    })
    if (ok) clearMutation.mutate()
  }

  return (
    <ScrollReveal className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground md:text-3xl">داده‌های نمونه</h1>
        <p className="mt-2 text-muted-foreground">با یک کلیک داده‌های نمونه را ایجاد یا حذف کنید.</p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-success-soft text-success">
              <Database className="h-6 w-6" />
            </div>
            <CardTitle className="mt-4">ایجاد داده‌های نمونه</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              محصولات، دسته‌بندی‌ها، تنظیمات و بخش‌های صفحه اصلی نمونه را به پایگاه داده اضافه می‌کند.
            </p>
            <Button loading={seedMutation.isPending} onClick={handleSeed}>
              ایجاد داده‌های نمونه
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-danger-soft text-danger">
              <Trash2 className="h-6 w-6" />
            </div>
            <CardTitle className="mt-4">حذف داده‌های نمونه</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              تمامی داده‌های نمونه شامل محصولات، دسته‌بندی‌ها و تنظیمات پیش‌فرض را حذف می‌کند.
            </p>
            <Button variant="danger" loading={clearMutation.isPending} onClick={handleClear}>
              حذف داده‌های نمونه
            </Button>
          </CardContent>
        </Card>
      </div>

      <Dialog />
    </ScrollReveal>
  )
}
