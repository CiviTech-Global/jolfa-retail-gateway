import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useLocation, useNavigate, useParams } from 'react-router'
import { Plus, Package, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { formatDate, formatNumber, formatPrice } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { DataTable, type SortState } from '@/components/ui/DataTable'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { ScrollReveal } from '@/components/motion/ScrollReveal'
import { useConfirmDialog } from '@/hooks/useConfirmDialog'
import { getProducts, deleteProduct } from '@/features/catalog/api'
import type { ProductFilters } from '@/features/catalog/types'
import { ProductFormDialog } from '../components/ProductFormDialog'

const PAGE_SIZE = 20

/** Maps the table's sort state onto the values the products API accepts. */
function toApiSort(sort: SortState | null): ProductFilters['sort'] {
  if (!sort) return undefined
  if (sort.columnId === 'price') return sort.direction === 'asc' ? 'price:asc' : 'price:desc'
  if (sort.columnId === 'createdAt') {
    return sort.direction === 'asc' ? 'createdAt:asc' : 'createdAt:desc'
  }
  return undefined
}

export function AdminProductsPage() {
  const [page, setPage] = useState(1)
  const [sort, setSort] = useState<SortState | null>(null)
  const queryClient = useQueryClient()
  const { confirm, Dialog } = useConfirmDialog()

  /*
   * The editor is a dialog, but it keeps its own URL: /admin/products/new and
   * /admin/products/:slug/edit still work as deep links and bookmarks, and the
   * dashboard's "new product" shortcut is unchanged. Routing state also means
   * the browser Back button closes the dialog, which is what people expect
   * after arriving at it from a link.
   */
  const navigate = useNavigate()
  const location = useLocation()
  const { slug: editSlug } = useParams<{ slug?: string }>()
  const isCreating = location.pathname.endsWith('/products/new')
  const isEditorOpen = isCreating || Boolean(editSlug)

  const closeEditor = () => navigate('/admin/products', { replace: true })

  const { data, isLoading } = useQuery({
    // `sort` belongs in the key: without it a re-sort would serve the previous
    // ordering from cache and the table would appear not to respond.
    queryKey: ['admin', 'products', page, sort],
    queryFn: () => getProducts({ page, limit: PAGE_SIZE, sort: toApiSort(sort) }),
  })

  const deleteMutation = useMutation({
    mutationFn: deleteProduct,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'products'] })
      void queryClient.invalidateQueries({ queryKey: ['products'] })
      toast.success('محصول حذف شد')
    },
  })

  async function handleDelete(slug: string) {
    const ok = await confirm({
      title: 'حذف محصول',
      description: 'آیا مطمئنید؟ این عملیات قابل بازگشت نیست.',
      confirmText: 'حذف',
      cancelText: 'انصراف',
      variant: 'danger',
    })
    if (ok) deleteMutation.mutate(slug)
  }

  return (
    <ScrollReveal className="space-y-6">
      <PageHeader
        title="مدیریت محصولات"
        description="مشاهده، ویرایش و مدیریت موجودی محصولات."
        action={
          <Button onClick={() => navigate('/admin/products/new')} className="gap-2">
            <Plus className="h-4 w-4" />
            محصول جدید
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>لیست محصولات</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            caption="فهرست محصولات فروشگاه"
            rows={data?.products ?? []}
            getRowId={(product) => product.id}
            isLoading={isLoading}
            emptyMessage="محصولی یافت نشد."
            emptyIcon={<Package className="h-6 w-6" aria-hidden="true" />}
            // Controlled: the server sorts and paginates. Only the two columns
            // the API can actually order by are marked sortable — offering to
            // sort by title would silently reorder the current page alone.
            sort={sort}
            onSortChange={(next) => {
              setSort(next)
              setPage(1)
            }}
            pagination={{
              page,
              pageSize: PAGE_SIZE,
              total: data?.meta.total,
              totalPages: data?.meta.totalPages,
              onPageChange: setPage,
            }}
            columns={[
              {
                id: 'title',
                header: 'محصول',
                cell: (product) => (
                  <div className="flex flex-col">
                    <span className="font-medium text-foreground">{product.title}</span>
                    {product.sku && (
                      <span className="ltr-text text-xs text-muted-foreground">{product.sku}</span>
                    )}
                  </div>
                ),
              },
              {
                id: 'category',
                header: 'زیردسته',
                hideBelow: 'md',
                cell: (product) => (
                  <span className="text-muted-foreground">{product.category.name}</span>
                ),
              },
              {
                id: 'price',
                header: 'قیمت',
                numeric: true,
                sortable: true,
                cell: (product) => formatPrice(product.price),
              },
              {
                id: 'stock',
                header: 'موجودی',
                numeric: true,
                hideBelow: 'sm',
                cell: (product) => (
                  <span
                    className={
                      product.stockQuantity === 0
                        ? 'text-danger'
                        : product.stockQuantity <= 5
                          ? 'text-warning'
                          : undefined
                    }
                  >
                    {formatNumber(product.stockQuantity)}
                  </span>
                ),
              },
              {
                id: 'createdAt',
                header: 'تاریخ ثبت',
                numeric: true,
                sortable: true,
                hideBelow: 'lg',
                cell: (product) => formatDate(product.createdAt),
              },
              {
                id: 'status',
                header: 'وضعیت',
                align: 'center',
                cell: (product) => (
                  <Badge variant={product.isActive ? 'success' : 'danger'}>
                    {product.isActive ? 'فعال' : 'غیرفعال'}
                  </Badge>
                ),
              },
              {
                id: 'actions',
                header: 'عملیات',
                align: 'end',
                width: '7rem',
                cell: (product) => (
                  <div className="flex justify-end gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => navigate(`/admin/products/${product.slug}/edit`)}
                      aria-label={`ویرایش ${product.title}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      loading={deleteMutation.isPending}
                      onClick={() => handleDelete(product.slug)}
                      aria-label={`حذف ${product.title}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ),
              },
            ]}
          />
        </CardContent>
      </Card>

      <ProductFormDialog
        open={isEditorOpen}
        onOpenChange={(next) => {
          if (!next) closeEditor()
        }}
        slug={editSlug}
      />

      <Dialog />
    </ScrollReveal>
  )
}
