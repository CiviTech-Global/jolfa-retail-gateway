import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import { CategoryList } from '../components/CategoryList'
import { ProductGrid } from '../components/ProductGrid'
import { getCategories, getProducts } from '../api'

export function HomePage() {
  const { data: categoriesData, isLoading: categoriesLoading } = useQuery({
    queryKey: ['categories', 'tree'],
    queryFn: () => getCategories(true),
  })

  const { data: productsData, isLoading: productsLoading } = useQuery({
    queryKey: ['products', 'featured'],
    queryFn: () => getProducts({ featured: true, limit: 8 }),
  })

  return (
    <div className="flex-1">
      <section className="bg-primary py-16 text-primary-foreground">
        <div className="mx-auto max-w-7xl px-4 text-center">
          <h1 className="text-3xl font-bold sm:text-4xl md:text-5xl">بازارچه جلفا</h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg opacity-90">
            محصولات محلی، سنتی و باکیفیت از بازارچه جلفا مستقیماً به دست شما
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <Link
              to="/products"
              className="inline-flex h-11 items-center justify-center rounded-lg bg-background px-6 font-medium text-primary transition-colors hover:bg-background/90"
            >
              مشاهده محصولات
            </Link>
            <Link
              to="/categories"
              className="inline-flex h-11 items-center justify-center rounded-lg border border-primary-foreground/30 px-6 font-medium transition-colors hover:bg-primary-foreground/10"
            >
              دسته‌بندی‌ها
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-foreground">دسته‌بندی‌ها</h2>
          <Link to="/categories" className="text-sm font-medium text-primary hover:underline">
            مشاهده همه
          </Link>
        </div>
        {categoriesLoading ? (
          <p className="text-gray-500">در حال بارگذاری ...</p>
        ) : (
          <CategoryList categories={categoriesData?.categories ?? []} />
        )}
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-foreground">محصولات ویژه</h2>
          <Link to="/products" className="text-sm font-medium text-primary hover:underline">
            مشاهده همه
          </Link>
        </div>
        {productsLoading ? (
          <p className="text-gray-500">در حال بارگذاری ...</p>
        ) : (
          <ProductGrid products={productsData?.products ?? []} />
        )}
      </section>
    </div>
  )
}
