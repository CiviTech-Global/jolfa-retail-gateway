import { useQuery } from '@tanstack/react-query'
import { getPublicHomepageSections } from '@/features/cms/api'
import { renderSection } from '@/features/cms/section-registry'

export function HomePage() {
  const { data: sections, isLoading } = useQuery({
    queryKey: ['homepage-sections', 'public'],
    queryFn: getPublicHomepageSections,
  })

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center py-20">
        <p className="text-muted-foreground">در حال بارگذاری ...</p>
      </div>
    )
  }

  const visibleSections = sections ?? []

  if (visibleSections.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-24 text-center">
        <h2 className="text-2xl font-bold text-foreground">فروشگاه آماده راه‌اندازی است</h2>
        <p className="mx-auto mt-3 max-w-md text-muted-foreground">
          هنوز بخشی برای نمایش وجود ندارد. از پنل مدیریت می‌توانید داده‌های نمونه را ایجاد و بخش‌های صفحه اصلی را فعال کنید.
        </p>
      </div>
    )
  }

  return <div className="flex-1">{visibleSections.map(renderSection)}</div>
}
