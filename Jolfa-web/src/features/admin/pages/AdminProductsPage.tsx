import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router'
import { Plus, Package, Pencil, Trash2 } from 'lucide-react'
import { formatPrice } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { ScrollReveal } from '@/components/motion/ScrollReveal'
import { getProducts, deleteProduct } from '@/features/catalog/api'

export function AdminProductsPage() {
  const [page, setPage] = useState(1)
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'products', page],
    queryFn: () => getProducts({ page, limit: 20 }),
  })

  const deleteMutation = useMutation({
    mutationFn: deleteProduct,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'products'] })
      void queryClient.invalidateQueries({ queryKey: ['products'] })
    },
  })

  return (
    <ScrollReveal className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground md:text-3xl">مدیریت محصولات</h1>
          <p className="mt-2 text-muted-foreground">مشاهده، ویرایش و مدیریت موجودی محصولات.</p>
        </div>
        <Button asChild>
          <Link to="/admin/products/new" className="inline-flex items-center gap-2">
            <Plus className="h-4 w-4" />
            محصول جدید
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>لیست محصولات</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">محصول</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">دسته‌بندی</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">قیمت</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">موجودی</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">وضعیت</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">عملیات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                      در حال بارگذاری ...
                    </td>
                  </tr>
                ) : data?.products.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                      <div className="flex flex-col items-center justify-center gap-3">
                        <Package className="h-10 w-10 text-muted-foreground/60" />
                        <span>محصولی یافت نشد.</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  data?.products.map((product) => (
                    <tr key={product.id}>
                      <td className="px-4 py-3 font-medium text-foreground">{product.title}</td>
                      <td className="px-4 py-3 text-foreground">{product.category.name}</td>
                      <td className="px-4 py-3 tabular-nums text-foreground">{formatPrice(product.price)}</td>
                      <td className="px-4 py-3 text-foreground">{product.stockQuantity}</td>
                      <td className="px-4 py-3">
                        <Badge variant={product.isActive ? 'success' : 'danger'}>
                          {product.isActive ? 'فعال' : 'غیرفعال'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" variant="outline" asChild>
                            <Link to={`/admin/products/${product.slug}/edit`}>
                              <Pencil className="h-4 w-4" />
                              <span className="sr-only">ویرایش</span>
                            </Link>
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            loading={deleteMutation.isPending}
                            onClick={() => deleteMutation.mutate(product.slug)}
                          >
                            <Trash2 className="h-4 w-4" />
                            <span className="sr-only">حذف</span>
                          </Button>
                        </div>
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
        </CardContent>
      </Card>
    </ScrollReveal>
  )
}
