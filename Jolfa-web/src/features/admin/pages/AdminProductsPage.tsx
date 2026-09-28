import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useLocation, useNavigate, useParams } from 'react-router'
import { Plus, Package, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { formatDate, formatNumber, formatPrice } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { DataTable, type SortState } from '@/components/ui/DataTable'
import { DebouncedSearchInput, FilterBar, FilterField } from '@/components/ui/FilterBar'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select'
import { getCategories } from '@/features/catalog/api'
import type { CategoryTreeDto } from '@/features/catalog/types'
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
  const suffix = sort.direction === 'asc' ? 'asc' : 'desc'
  if (sort.columnId === 'price') return `price:${suffix}` as ProductFilters['sort']
  if (sort.columnId === 'createdAt') return `createdAt:${suffix}` as ProductFilters['sort']
  if (sort.columnId === 'title') return `title:${suffix}` as ProductFilters['sort']
  if (sort.columnId === 'stock') return `stock:${suffix}` as ProductFilters['sort']
  return undefined
}

const ANY = '__any__'
/** Anything at or below this counts as "running low" for the quick filter. */
const LOW_STOCK_THRESHOLD = 5

export function AdminProductsPage() {
  const [page, setPage] = useState(1)
  const [sort, setSort] = useState<SortState | null>(null)
  const [q, setQ] = useState('')
  const [categorySlug, setCategorySlug] = useState(ANY)
  const [status, setStatus] = useState(ANY)
  const [stockFilter, setStockFilter] = useState(ANY)

  const { data: categoryData } = useQuery({
    queryKey: ['categories', 'tree'],
    queryFn: () => getCategories(true),
  })
  const categoryTree = (categoryData?.categories ?? []) as CategoryTreeDto[]

  /** Every filter change returns to page 1; page 4 of the old result is meaningless. */
  const applyFilter = <T,>(setter: (next: T) => void) => (next: T) => {
    setPage(1)
    setter(next)
  }

  const activeFilterCount = [q !== '', categorySlug !== ANY, status !== ANY, stockFilter !== ANY]
    .filter(Boolean).length

  const clearFilters = () => {
    setPage(1)
    setQ('')
    setCategorySlug(ANY)
    setStatus(ANY)
    setStockFilter(ANY)
  }
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
    queryKey: ['admin', 'products', page, sort, q, categorySlug, status, stockFilter],
    queryFn: () =>
      getProducts({
        page,
        limit: PAGE_SIZE,
        sort: toApiSort(sort),
        q: q || undefined,
        categorySlug: categorySlug === ANY ? undefined : categorySlug,
        // The storefront hides inactive products by default; the admin list has
        // to be able to reach them, which is the only way to find something
        // that was switched off and forgotten.
        isActive: status === ANY ? undefined : (status as 'true' | 'false'),
        maxStock:
          stockFilter === 'out' ? 0 : stockFilter === 'low' ? LOW_STOCK_THRESHOLD : undefined,
        onSale: stockFilter === 'sale' ? true : undefined,
      }),
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

      <FilterBar activeCount={activeFilterCount} onClear={clearFilters}>
        <FilterField label="جستجو" className="min-w-[16rem] flex-1">
          <DebouncedSearchInput
            value={q}
            onChange={applyFilter(setQ)}
            placeholder="نام محصول یا کد کالا ..."
          />
        </FilterField>

        <FilterField label="زیردسته">
          <Select value={categorySlug} onValueChange={applyFilter(setCategorySlug)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>همه</SelectItem>
              {categoryTree.map((parent) => [
                <SelectItem key={parent.id} value={parent.slug}>
                  {parent.name}
                </SelectItem>,
                ...(parent.children ?? []).map((child) => (
                  <SelectItem key={child.id} value={child.slug}>
                    {`${parent.name} › ${child.name}`}
                  </SelectItem>
                )),
              ])}
            </SelectContent>
          </Select>
        </FilterField>

        <FilterField label="وضعیت">
          <Select value={status} onValueChange={applyFilter(setStatus)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>همه</SelectItem>
              <SelectItem value="true">فعال</SelectItem>
              <SelectItem value="false">غیرفعال</SelectItem>
            </SelectContent>
          </Select>
        </FilterField>

        <FilterField label="موجودی و تخفیف">
          <Select value={stockFilter} onValueChange={applyFilter(setStockFilter)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>همه</SelectItem>
              <SelectItem value="out">ناموجود</SelectItem>
              <SelectItem value="low">رو به اتمام (۵ یا کمتر)</SelectItem>
              <SelectItem value="sale">دارای تخفیف</SelectItem>
            </SelectContent>
          </Select>
        </FilterField>
      </FilterBar>

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
                sortable: true,
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
                sortable: true,
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
