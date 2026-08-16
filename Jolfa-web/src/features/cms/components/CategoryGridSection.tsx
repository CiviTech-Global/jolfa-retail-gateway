import { Link } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { getCategories } from '@/features/catalog/api'
import { CategoryList } from '@/features/catalog/components/CategoryList'
import { ScrollReveal } from '@/components/motion/ScrollReveal'

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
    <section className="mx-auto max-w-7xl px-4 py-14">
      <ScrollReveal direction="up" className="mb-8 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">دسته‌بندی‌ها</h2>
          <div className="mt-2 h-1 w-12 rounded-full bg-accent" />
        </div>
        <Link
          to="/categories"
          className="text-sm font-medium text-primary transition-colors hover:text-accent"
        >
          مشاهده همه
        </Link>
      </ScrollReveal>

      {isLoading ? (
        <div className="rounded-2xl border border-border bg-surface p-12 text-center text-muted-foreground">
          در حال بارگذاری ...
        </div>
      ) : (
        <CategoryList categories={categories} />
      )}
    </section>
  )
}
