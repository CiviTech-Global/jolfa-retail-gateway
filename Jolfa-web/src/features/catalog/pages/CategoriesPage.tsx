import { useQuery } from '@tanstack/react-query'
import { CategoryList } from '../components/CategoryList'
import { getCategories } from '../api'

export function CategoriesPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['categories', 'tree'],
    queryFn: () => getCategories(true),
  })

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="text-2xl font-bold text-foreground">دسته‌بندی‌ها</h1>
      <div className="mt-6">
        {isLoading ? (
          <p className="text-gray-500">در حال بارگذاری ...</p>
        ) : (
          <CategoryList categories={data?.categories ?? []} />
        )}
      </div>
    </div>
  )
}
