export function HomePage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-12">
      <h1 className="text-3xl font-bold text-primary">به ارس پرو خوش آمدید</h1>
      <p className="mt-4 text-foreground">فروشگاه محصولات محلی و سنتی ارس پرو</p>
    </div>
  )
}

export function NotFoundPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-20 text-center">
      <h1 className="text-4xl font-bold text-foreground">۴۰۴</h1>
      <p className="mt-4 text-muted-foreground">صفحه‌ای که به دنبال آن بودید یافت نشد.</p>
    </div>
  )
}

export function AdminDashboardPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground">داشبورد مدیریت</h1>
      <p className="mt-2 text-muted-foreground">در اینجا خلاصه‌ای از وضعیت فروشگاه نمایش داده می‌شود.</p>
    </div>
  )
}

export function AdminPlaceholderPage({ title }: { title: string }) {
  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground">{title}</h1>
      <p className="mt-2 text-muted-foreground">این بخش در حال توسعه است.</p>
    </div>
  )
}
