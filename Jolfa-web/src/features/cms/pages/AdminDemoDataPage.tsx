import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Database, Trash2, Check } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { ScrollReveal } from '@/components/motion/ScrollReveal'
import { useConfirmDialog } from '@/hooks/useConfirmDialog'
import { runDemoAction } from '../api'

const seedCoverage = [
  { label: 'دسته‌بندی‌ها', detail: '۴ دسته‌بندی نمونه با تصویر واقعی' },
  { label: 'محصولات', detail: '۶ محصول با قیمت، تخفیف، موجودی و گالری ۳ تصویری هرکدام' },
  { label: 'اسلایدر بنر', detail: '۳ اسلاید تمام‌عرض با تصویر، عنوان و دکمه' },
  { label: 'پیشنهادهای لحظه‌ای', detail: 'شمارش معکوس + محصولات تخفیف‌دار' },
  { label: 'شبکه دسته‌بندی و بنرهای تبلیغاتی', detail: '۴ بنر با تصویر، عنوان و لینک واقعی' },
  { label: 'کاروسل محصولات ویژه و جدید', detail: 'دو بخش کاروسل مستقل' },
  { label: 'نوار برندها و نمادهای اعتماد', detail: '۵ برند با لوگو + ۴ نماد اعتماد' },
  { label: 'مجله و دانلود اپلیکیشن', detail: '۳ پست وبلاگ مصور + بنر دانلود اپ' },
  { label: 'خبرنامه', detail: 'فرم عضویت در پایین صفحه' },
  { label: 'سفارش‌ها و تراکنش‌ها', detail: '۶ سفارش نمونه با وضعیت‌های مختلف' },
  { label: 'تنظیمات نمایش', detail: 'نام فروشگاه، هدر، فوتر و صفحات ثابت' },
  { label: 'متن جایگزین تصاویر (ALT)', detail: 'تمام تصاویر نمونه دارای توضیح متنی هستند' },
]

export function AdminDemoDataPage() {
  const queryClient = useQueryClient()
  const { confirm, Dialog } = useConfirmDialog()

  function invalidateAll() {
    void queryClient.invalidateQueries({ queryKey: ['products'] })
    void queryClient.invalidateQueries({ queryKey: ['categories'] })
    void queryClient.invalidateQueries({ queryKey: ['homepage-sections'] })
    void queryClient.invalidateQueries({ queryKey: ['settings'] })
    void queryClient.invalidateQueries({ queryKey: ['admin', 'homepage-sections'] })
    void queryClient.invalidateQueries({ queryKey: ['admin', 'orders'] })
    void queryClient.invalidateQueries({ queryKey: ['admin', 'dashboard'] })
  }

  const seedMutation = useMutation({
    mutationFn: () => runDemoAction({ action: 'seed' }),
    onSuccess: () => {
      invalidateAll()
      toast.success('داده‌های نمونه ایجاد شدند')
    },
  })

  const clearMutation = useMutation({
    mutationFn: () => runDemoAction({ action: 'clear' }),
    onSuccess: () => {
      invalidateAll()
      toast.success('داده‌های نمونه حذف شدند')
    },
  })

  async function handleSeed() {
    const ok = await confirm({
      title: 'ایجاد داده‌های نمونه',
      description:
        'این عملیات محصولات، دسته‌بندی‌ها، تمام بخش‌های صفحه اصلی (اسلایدر، پیشنهادهای لحظه‌ای، بنرها، برندها، مجله، دانلود اپ و ...)، سفارش‌های نمونه و تنظیمات نمایش را ایجاد یا به‌روزرسانی می‌کند. ادامه می‌دهید؟',
      confirmText: 'ایجاد',
      cancelText: 'انصراف',
      variant: 'primary',
    })
    if (ok) seedMutation.mutate()
  }

  async function handleClear() {
    const ok = await confirm({
      title: 'حذف داده‌های نمونه',
      description:
        'تمامی داده‌های نمونه شامل محصولات، دسته‌بندی‌ها، بنرها، بخش‌های صفحه اصلی، سفارش‌ها و تنظیماتی که توسط این ابزار ایجاد شده‌اند حذف خواهند شد. این عملیات قابل بازگشت نیست.',
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
        <p className="mt-2 text-muted-foreground">
          با یک کلیک، فروشگاه را با محتوای نمونه کامل برای تمام بخش‌های صفحه اصلی و صفحات دیگر پر کنید.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>این ابزار چه چیزهایی می‌سازد؟</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {seedCoverage.map((item) => (
                <li key={item.label} className="flex items-start gap-2 text-sm">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                  <div>
                    <span className="font-medium text-foreground">{item.label}</span>
                    <p className="text-muted-foreground">{item.detail}</p>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-success-soft text-success">
                <Database className="h-6 w-6" />
              </div>
              <CardTitle className="mt-4">ایجاد داده‌های نمونه</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                اجرای دوباره این عملیات، محتوای نمونه موجود را به‌روزرسانی می‌کند و مشکلی ایجاد نمی‌کند.
              </p>
              <Button loading={seedMutation.isPending} onClick={handleSeed} className="w-full">
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
                فقط محتوایی که توسط این ابزار ایجاد شده حذف می‌شود؛ محصولات و تنظیماتی که خودتان اضافه کرده‌اید دست‌نخورده می‌مانند.
              </p>
              <Button variant="danger" loading={clearMutation.isPending} onClick={handleClear} className="w-full">
                حذف داده‌های نمونه
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog />
    </ScrollReveal>
  )
}
