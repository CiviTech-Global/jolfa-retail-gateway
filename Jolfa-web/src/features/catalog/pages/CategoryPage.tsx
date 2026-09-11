import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router'
import { ProductGrid } from '../components/ProductGrid'
import { getCategoryBySlug, getProducts } from '../api'
import { BackButton, Breadcrumbs } from '@/components/layout/Breadcrumbs'
import { FALLBACK_IMAGE_URL } from '@/lib/utils'
import type { CategoryTreeDto } from '../types'

const faNumber = new Intl.NumberFormat('fa-IR')

/**
 * One page serves both levels of the catalogue, because the URL shape is the
 * same and so is most of the layout. What differs is what the page is *for*:
 *
 *   top-level category — a menu. Its subcategories are the point, and the
 *                        products underneath them are a preview.
 *   subcategory        — a shelf. The products are the point.
 *
 * The two are distinguished by whether the category has children, not by
 * `parentId`, so a top-level category with no subcategories yet still renders
 * something useful instead of an empty menu.
 */
export function CategoryPage() {
  const { slug } = useParams<{ slug: string }>()

  const { data: categoryData, isLoading: categoryLoading } = useQuery({
    queryKey: ['category', slug],
    queryFn: () => getCategoryBySlug(slug!),
    enabled: Boolean(slug),
  })

  // The API expands a top-level slug to every product across its subcategories,
  // so this one call is right for both levels.
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
  const subcategories = category.children
  const hasSubcategories = subcategories.length > 0
  const products = productsData?.products ?? []

  // A subcategory shows its parent in the trail; a top-level category has none.
  const trail = [
    { label: 'خانه', to: '/' },
    { label: 'دسته‌بندی‌ها', to: '/categories' },
    ...(category.parent
      ? [{ label: category.parent.name, to: `/categories/${category.parent.slug}` }]
      : []),
    { label: category.name },
  ]

  const backTarget = category.parent
    ? { to: `/categories/${category.parent.slug}`, label: `بازگشت به ${category.parent.name}` }
    : { to: '/categories', label: 'بازگشت به دسته‌بندی‌ها' }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <Breadcrumbs className="mb-4" items={trail} />
      <BackButton to={backTarget.to} label={backTarget.label} className="-ms-2 mb-2" />

      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h1 className="text-2xl font-bold text-foreground">{category.name}</h1>
        <span className="text-sm text-muted-foreground">
          {faNumber.format(category.productCount)} محصول
        </span>
      </div>
      {category.description && <p className="mt-2 text-muted-foreground">{category.description}</p>}

      {hasSubcategories && (
        <section className="mt-8">
          <h2 className="text-lg font-semibold text-foreground">زیردسته‌ها</h2>
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {subcategories.map((sub) => (
              <SubcategoryCard key={sub.id} subcategory={sub} />
            ))}
          </div>
        </section>
      )}

      <section className="mt-10">
        {hasSubcategories && (
          <h2 className="mb-4 text-lg font-semibold text-foreground">همه محصولات این دسته‌بندی</h2>
        )}
        {productsLoading ? (
          <p className="text-muted-foreground">در حال بارگذاری ...</p>
        ) : products.length > 0 ? (
          <ProductGrid products={products} />
        ) : (
          <div className="rounded-2xl border border-border bg-surface p-12 text-center text-muted-foreground">
            {hasSubcategories
              ? 'هنوز محصولی در زیردسته‌های این دسته‌بندی ثبت نشده است.'
              : 'هنوز محصولی در این دسته‌بندی ثبت نشده است.'}
          </div>
        )}
      </section>
    </div>
  )
}

function SubcategoryCard({ subcategory }: { subcategory: CategoryTreeDto }) {
  return (
    <Link
      to={`/categories/${subcategory.slug}`}
      className="group block overflow-hidden rounded-2xl border border-border bg-surface shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md"
    >
      <div className="aspect-[4/3] overflow-hidden bg-muted">
        <img
          src={subcategory.imageUrl ?? FALLBACK_IMAGE_URL}
          alt={subcategory.name}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
          loading="lazy"
        />
      </div>
      <div className="p-3">
        <h3 className="text-sm font-semibold text-foreground transition-colors group-hover:text-primary">
          {subcategory.name}
        </h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {faNumber.format(subcategory.productCount)} محصول
        </p>
      </div>
    </Link>
  )
}
