import { Link } from 'react-router'
import { ScrollReveal } from '@/components/motion/ScrollReveal'
import { FALLBACK_IMAGE_URL } from '@/lib/utils'
import type { CategoryDto, CategoryTreeDto } from '../types'

interface CategoryListProps {
  categories: CategoryDto[] | CategoryTreeDto[]
}

function isTree(categories: CategoryDto[] | CategoryTreeDto[]): categories is CategoryTreeDto[] {
  return categories.length > 0 && 'children' in categories[0]
}

function getImageUrl(category: CategoryDto): string {
  return category.imageUrl ?? FALLBACK_IMAGE_URL
}

export function CategoryList({ categories }: CategoryListProps) {
  if (categories.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-12 text-center text-muted-foreground">
        هیچ دسته‌بندی یافت نشد.
      </div>
    )
  }

  const items = isTree(categories) ? categories : categories

  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((category, index) => (
        <ScrollReveal key={category.id} direction="up" delay={index * 0.05}>
          <Link
            to={`/categories/${category.slug}`}
            className="group block overflow-hidden rounded-2xl border border-border bg-surface shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md"
          >
            <div className="aspect-[4/3] overflow-hidden bg-muted">
              <img
                src={getImageUrl(category)}
                alt={category.name}
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                loading="lazy"
              />
            </div>
            <div className="p-4">
              <h3 className="font-semibold text-foreground transition-colors group-hover:text-primary">
                {category.name}
              </h3>
              {category.description && (
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                  {category.description}
                </p>
              )}
            </div>
          </Link>
        </ScrollReveal>
      ))}
    </div>
  )
}
