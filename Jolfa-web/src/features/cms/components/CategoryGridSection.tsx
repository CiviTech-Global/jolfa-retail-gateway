import { Link } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { getCategories } from '@/features/catalog/api'
import { CategoryList } from '@/features/catalog/components/CategoryList'

interface CategoryGridSectionProps {
  config: Record<string, unknown>
}

export function CategoryGridSection({ config }: CategoryGridSectionProps) {
  const limit = (config.limit as number | undefined) ?? 8
  const { data, isLoading } = useQuery({
    queryKey: ['categories', 'tree'],
    queryFn: () => getCategories(true),
  })

  const categories = data?.categories.slice(0, limit) ?? []

  return (
    <section className="mx-auto max-w-7xl px-4 py-12">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-2xl font-bold text-foreground">دسته‌بندی‌ها</h2>
        <Link to="/categories" className="text-sm font-medium text-primary hover:underline">
          مشاهده همه
        </Link>
      </div>
      {isLoading ? <p className="text-gray-500">در حال بارگذاری ...</p> : <CategoryList categories={categories} />}
    </section>
  )
}
