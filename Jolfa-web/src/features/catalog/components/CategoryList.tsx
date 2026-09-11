import { Link } from 'react-router'
import { ScrollReveal } from '@/components/motion/ScrollReveal'
import { FALLBACK_IMAGE_URL, formatNumber } from '@/lib/utils'
import type { CategoryDto, CategoryTreeDto } from '../types'

interface CategoryListProps {
  categories: CategoryDto[] | CategoryTreeDto[]
  /** How many subcategory links to show on a card before "+N". */
  maxSubcategoryChips?: number
}


function hasChildren(category: CategoryDto | CategoryTreeDto): category is CategoryTreeDto {
  return 'children' in category && Array.isArray(category.children)
}

export function CategoryList({ categories, maxSubcategoryChips = 4 }: CategoryListProps) {
  if (categories.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-12 text-center text-muted-foreground">
        هیچ دسته‌بندی یافت نشد.
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
      {categories.map((category, index) => {
        // Surfacing a few subcategories on the card turns the listing into a
        // real menu: a visitor can jump straight to "پوشک" instead of opening
        // the parent and choosing again. The parent link stays the card itself.
        const subcategories = hasChildren(category) ? category.children : []
        const shown = subcategories.slice(0, maxSubcategoryChips)
        const overflow = subcategories.length - shown.length

        return (
          <ScrollReveal key={category.id} direction="up" delay={index * 0.05}>
            <div className="group flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md">
              <Link to={`/categories/${category.slug}`} className="block">
                <div className="aspect-[4/3] overflow-hidden bg-muted">
                  <img
                    src={category.imageUrl ?? FALLBACK_IMAGE_URL}
                    alt={category.name}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                    loading="lazy"
                  />
                </div>
              </Link>

              <div className="flex flex-1 flex-col p-4">
                <Link to={`/categories/${category.slug}`} className="block">
                  <h3 className="font-semibold text-foreground transition-colors group-hover:text-primary">
                    {category.name}
                  </h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {formatNumber(category.productCount)} محصول
                  </p>
                  {category.description && (
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                      {category.description}
                    </p>
                  )}
                </Link>

                {shown.length > 0 && (
                  <ul className="mt-3 flex flex-wrap gap-1.5">
                    {shown.map((sub) => (
                      <li key={sub.id}>
                        {/* Nested inside the card but not inside the card's own
                            link — an anchor within an anchor is invalid HTML and
                            browsers recover from it unpredictably. */}
                        <Link
                          to={`/categories/${sub.slug}`}
                          className="inline-block rounded-full border border-border bg-background px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-primary"
                        >
                          {sub.name}
                        </Link>
                      </li>
                    ))}
                    {overflow > 0 && (
                      <li>
                        <Link
                          to={`/categories/${category.slug}`}
                          className="inline-block rounded-full px-2.5 py-1 text-xs text-primary hover:underline"
                        >
                          + {formatNumber(overflow)} مورد دیگر
                        </Link>
                      </li>
                    )}
                  </ul>
                )}
              </div>
            </div>
          </ScrollReveal>
        )
      })}
    </div>
  )
}
