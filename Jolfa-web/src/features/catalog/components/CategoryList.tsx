import { Link } from 'react-router'
import type { CategoryDto, CategoryTreeDto } from '../types'

interface CategoryListProps {
  categories: CategoryDto[] | CategoryTreeDto[]
}

function isTree(categories: CategoryDto[] | CategoryTreeDto[]): categories is CategoryTreeDto[] {
  return categories.length > 0 && 'children' in categories[0]
}

function getImageUrl(category: CategoryDto): string {
  return (
    category.imageUrl ??
    `https://placehold.co/400x300/e2e8f0/475569?text=${encodeURIComponent(category.name)}`
  )
}

export function CategoryList({ categories }: CategoryListProps) {
  if (categories.length === 0) {
    return <p className="text-gray-500">هیچ دسته‌بندی یافت نشد.</p>
  }

  const items = isTree(categories) ? categories : categories

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((category) => (
        <Link
          key={category.id}
          to={`/categories/${category.slug}`}
          className="group overflow-hidden rounded-xl border border-border bg-background shadow-sm transition-shadow hover:shadow-md"
        >
          <div className="aspect-[4/3] overflow-hidden">
            <img
              src={getImageUrl(category)}
              alt={category.name}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
              loading="lazy"
            />
          </div>
          <div className="p-4">
            <h3 className="font-semibold text-foreground">{category.name}</h3>
            {category.description && (
              <p className="mt-1 line-clamp-2 text-sm text-gray-500">{category.description}</p>
            )}
          </div>
        </Link>
      ))}
    </div>
  )
}
