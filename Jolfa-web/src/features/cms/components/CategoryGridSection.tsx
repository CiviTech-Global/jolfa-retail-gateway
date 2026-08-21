import { Link } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { getCategories } from '@/features/catalog/api'
import { ScrollReveal } from '@/components/motion/ScrollReveal'
import { FALLBACK_IMAGE_URL } from '@/lib/utils'
import type { CategoryDto, CategoryTreeDto } from '@/features/catalog/types'

interface CategoryGridSectionProps {
  config: Record<string, unknown>
}

function getIconUrl(category: CategoryDto): string {
  return category.imageUrl ?? FALLBACK_IMAGE_URL
}

export function CategoryGridSection({ config }: CategoryGridSectionProps) {
  const limit = (config.limit as number | undefined) ?? 8
  const { data, isLoading } = useQuery({
    queryKey: ['categories', 'tree'],
    queryFn: () => getCategories(true),
  })

  const categories = (data?.categories.slice(0, limit) ?? []) as CategoryTreeDto[]

  return (
    <section className="mx-auto max-w-7xl px-4 py-10 md:py-14">
      <ScrollReveal direction="up" className="mb-6 flex items-center justify-between md:mb-8">
        <div>
          <h2 className="text-xl font-bold text-foreground md:text-2xl">دسته‌بندی‌ها</h2>
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
      ) : categories.length === 0 ? (
        <p className="text-muted-foreground">هیچ دسته‌بندی یافت نشد.</p>
      ) : (
        <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
          {categories.map((category, index) => (
            <ScrollReveal key={category.id} direction="up" delay={index * 0.04}>
              <Link
                to={`/categories/${category.slug}`}
                className="group flex flex-col items-center gap-2 text-center"
              >
                <span className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border border-border bg-primary-soft shadow-sm transition-all group-hover:-translate-y-1 group-hover:border-primary group-hover:shadow-md md:h-20 md:w-20">
                  <img
                    src={getIconUrl(category)}
                    alt={category.name}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                </span>
                <span className="line-clamp-2 text-xs font-medium text-foreground transition-colors group-hover:text-primary md:text-sm">
                  {category.name}
                </span>
              </Link>
            </ScrollReveal>
          ))}
        </div>
      )}
    </section>
  )
}
