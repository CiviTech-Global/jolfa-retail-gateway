import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/Button'
import { runDemoAction } from '../api'

export function AdminDemoDataPage() {
  const queryClient = useQueryClient()

  const seedMutation = useMutation({
    mutationFn: () => runDemoAction({ action: 'seed' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['products'] })
      void queryClient.invalidateQueries({ queryKey: ['categories'] })
      void queryClient.invalidateQueries({ queryKey: ['homepage-sections'] })
      void queryClient.invalidateQueries({ queryKey: ['settings'] })
      void queryClient.invalidateQueries({ queryKey: ['admin', 'orders'] })
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
    },
  })

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground">داده‌های نمونه</h1>
      <p className="mt-2 text-gray-600">با یک کلیک داده‌های نمونه را ایجاد یا حذف کنید.</p>

      <div className="mt-6 flex flex-col gap-4 rounded-xl border border-border bg-background p-6 sm:flex-row">
        <Button
          size="lg"
          loading={seedMutation.isPending}
          onClick={() => seedMutation.mutate()}
        >
          ایجاد داده‌های نمونه
        </Button>
        <Button
          size="lg"
          variant="danger"
          loading={clearMutation.isPending}
          onClick={() => clearMutation.mutate()}
        >
          حذف داده‌های نمونه
        </Button>
      </div>

      {seedMutation.isSuccess && (
        <p className="mt-4 font-medium text-green-600">داده‌های نمونه با موفقیت ایجاد شدند.</p>
      )}
      {clearMutation.isSuccess && (
        <p className="mt-4 font-medium text-green-600">داده‌های نمونه با موفقیت حذف شدند.</p>
      )}
      {(seedMutation.error ?? clearMutation.error) && (
        <p className="mt-4 font-medium text-red-600">عملیات با خطا مواجه شد.</p>
      )}
    </div>
  )
}
