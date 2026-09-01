import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router'
import { ProductGrid } from '../components/ProductGrid'
import { getCategoryBySlug, getProducts } from '../api'
import { BackButton, Breadcrumbs } from '@/components/layout/Breadcrumbs'

export function CategoryPage() {
  const { slug } = useParams<{ slug: string }>()

  const { data: categoryData, isLoading: categoryLoading } = useQuery({
    queryKey: ['category', slug],
    queryFn: () => getCategoryBySlug(slug!),
    enabled: Boolean(slug),
  })

  const { data: productsData, isLoading: productsLoading } = useQuery({
    queryKey: ['products', { categorySlug: slug }],
    queryFn: () => getProducts({ categorySlug: slug, limit: 24 }),
    enabled: Boolean(slug),
  })

  if (categoryLoading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-12">
        <p className="text-muted-foreground">در حال بارگذاری ...</p>
      </div>
    )
  }

  if (!categoryData) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-12 text-center">
        <h1 className="text-2xl font-bold text-foreground">دسته‌بندی یافت نشد</h1>
        <Link to="/categories" className="mt-4 inline-block text-primary hover:underline">
          بازگشت به دسته‌بندی‌ها
        </Link>
      </div>
    )
  }

  const category = categoryData.category

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <Breadcrumbs
        className="mb-4"
        items={[
          { label: 'خانه', to: '/' },
          { label: 'دسته‌بندی‌ها', to: '/categories' },
          { label: category.name },
        ]}
      />
      <BackButton to="/categories" label="بازگشت به دسته‌بندی‌ها" className="-ms-2 mb-2" />
      <h1 className="text-2xl font-bold text-foreground">{category.name}</h1>
      {category.description && <p className="mt-2 text-muted-foreground">{category.description}</p>}

      {category.children.length > 0 && (
        <div className="mt-6 flex flex-wrap gap-2">
          {category.children.map((child) => (
            <Link
              key={child.id}
              to={`/categories/${child.slug}`}
              className="rounded-full border border-border bg-background px-4 py-2 text-sm text-foreground transition-colors hover:bg-muted"
            >
              {child.name}
            </Link>
          ))}
        </div>
      )}

      <div className="mt-8">
        {productsLoading ? (
          <p className="text-muted-foreground">در حال بارگذاری ...</p>
        ) : (
          <ProductGrid products={productsData?.products ?? []} />
        )}
      </div>
    </div>
  )
}
