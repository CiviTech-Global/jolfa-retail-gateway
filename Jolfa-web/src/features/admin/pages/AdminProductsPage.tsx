import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import { formatPrice } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { getProducts } from '@/features/catalog/api'

export function AdminProductsPage() {
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'products', page],
    queryFn: () => getProducts({ page, limit: 20 }),
  })

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">مدیریت محصولات</h1>
        <Button asChild>
          <Link to="/admin/products/new">محصول جدید</Link>
        </Button>
      </div>

      <div className="mt-6 overflow-hidden rounded-xl border border-border bg-background">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-muted text-foreground">
              <tr>
                <th className="px-4 py-3 text-right">محصول</th>
                <th className="px-4 py-3 text-right">دسته‌بندی</th>
                <th className="px-4 py-3 text-right">قیمت</th>
                <th className="px-4 py-3 text-right">موجودی</th>
                <th className="px-4 py-3 text-right">وضعیت</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                    در حال بارگذاری ...
                  </td>
                </tr>
              ) : (
                data?.products.map((product) => (
                  <tr key={product.id}>
                    <td className="px-4 py-3 font-medium text-foreground">{product.title}</td>
                    <td className="px-4 py-3 text-foreground">{product.category.name}</td>
                    <td className="px-4 py-3 text-foreground">{formatPrice(product.price)}</td>
                    <td className="px-4 py-3 text-foreground">{product.stockQuantity}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-1 text-xs ${
                          product.isActive
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {product.isActive ? 'فعال' : 'غیرفعال'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {data && data.meta.totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 border-t border-border p-4">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              قبلی
            </Button>
            <span className="text-sm text-foreground">
              صفحه {page} از {data.meta.totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= data.meta.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              بعدی
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
