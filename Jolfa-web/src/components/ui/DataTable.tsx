import { useMemo, useState, type ReactNode } from 'react'
import { ArrowDown, ArrowUp, ChevronsUpDown, Inbox } from 'lucide-react'
import { cn, formatNumber } from '@/lib/utils'
import { Skeleton } from './Skeleton'

/**
 * The one table in the application.
 *
 * Eleven admin screens previously hand-rolled their own `<table>`. They drifted
 * apart in padding, header weight, empty-state wording and alignment, none of
 * them could sort, and pagination — where it existed at all — was a bare
 * prev/next pair with no sense of position. This replaces all of them.
 *
 * Sorting and pagination each work in two modes, chosen by what you pass:
 *
 *   uncontrolled  omit `sort` / `pagination` and the table sorts and paginates
 *                 the rows it was given, in the browser. Right for a screen
 *                 that already loads the full list — categories, banners.
 *
 *   controlled    pass them and the table renders state and reports intent
 *                 without acting on it. Required when the server does the work,
 *                 because the table only ever sees one page and cannot sort
 *                 across the rest.
 *
 * Mixing them is the trap worth naming: client-side sorting over a
 * server-paginated list sorts *the current page only*, which looks like it
 * works and is wrong. Passing `pagination` therefore disables internal sorting
 * unless `sort` is supplied too.
 */

export type SortDirection = 'asc' | 'desc'

export interface SortState {
  columnId: string
  direction: SortDirection
}

export interface DataTableColumn<Row> {
  id: string
  header: ReactNode
  cell: (row: Row, index: number) => ReactNode
  /**
   * Numbers, prices, quantities, dates. Right-aligns in the reading sense and
   * switches on tabular figures so digits line up down the column — the single
   * biggest difference between a table that reads as data and one that reads as
   * a list of strings.
   */
  numeric?: boolean
  align?: 'start' | 'center' | 'end'
  sortable?: boolean
  /**
   * Value to sort on for uncontrolled sorting. Without it a sortable column
   * falls back to the rendered cell, which is a ReactNode and cannot be
   * compared — so a column that sorts must say what it sorts by.
   */
  sortValue?: (row: Row) => string | number | boolean | Date | null | undefined
  /** Hide below this breakpoint, so narrow screens drop detail instead of scrolling. */
  hideBelow?: 'sm' | 'md' | 'lg'
  width?: string
  headerClassName?: string
  cellClassName?: string
}

export interface DataTablePagination {
  page: number
  pageSize: number
  /** Total rows across all pages. Omit if unknown; the range readout adapts. */
  total?: number
  totalPages?: number
  onPageChange: (page: number) => void
  onPageSizeChange?: (pageSize: number) => void
  pageSizeOptions?: number[]
}

export interface DataTableProps<Row> {
  columns: DataTableColumn<Row>[]
  rows: Row[]
  getRowId: (row: Row) => string
  caption?: string
  isLoading?: boolean
  emptyMessage?: ReactNode
  emptyIcon?: ReactNode
  sort?: SortState | null
  onSortChange?: (sort: SortState | null) => void
  pagination?: DataTablePagination
  /** Uncontrolled page size when the table paginates for itself. */
  defaultPageSize?: number
  onRowClick?: (row: Row) => void
  rowClassName?: (row: Row, index: number) => string | undefined
  /** Turns off the table's own pagination without supplying a controlled one. */
  disableInternalPagination?: boolean
  className?: string
}

const HIDE_BELOW: Record<NonNullable<DataTableColumn<unknown>['hideBelow']>, string> = {
  sm: 'hidden sm:table-cell',
  md: 'hidden md:table-cell',
  lg: 'hidden lg:table-cell',
}

const DEFAULT_PAGE_SIZES = [10, 25, 50, 100]

function alignmentClass(column: DataTableColumn<unknown>): string {
  const align = column.align ?? (column.numeric ? 'end' : 'start')
  if (align === 'center') return 'text-center'
  if (align === 'end') return 'text-end'
  return 'text-start'
}

/** Nulls sort last in both directions — an absent value is not "smallest". */
function compareValues(a: unknown, b: unknown): number {
  const aMissing = a === null || a === undefined || a === ''
  const bMissing = b === null || b === undefined || b === ''
  if (aMissing && bMissing) return 0
  if (aMissing) return 1
  if (bMissing) return -1

  if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime()
  if (typeof a === 'number' && typeof b === 'number') return a - b
  if (typeof a === 'boolean' && typeof b === 'boolean') return Number(a) - Number(b)

  // `fa` collation so Persian sorts in Persian alphabetical order rather than
  // by code point, which scatters it. `numeric` so "سایز ۲" precedes "سایز ۱۰".
  return String(a).localeCompare(String(b), 'fa', { numeric: true, sensitivity: 'base' })
}

export function DataTable<Row>({
  columns,
  rows,
  getRowId,
  caption,
  isLoading = false,
  emptyMessage = 'موردی برای نمایش وجود ندارد.',
  emptyIcon,
  sort,
  onSortChange,
  pagination,
  defaultPageSize = 10,
  onRowClick,
  rowClassName,
  disableInternalPagination = false,
  className,
}: DataTableProps<Row>) {
  const isSortControlled = sort !== undefined
  const [internalSort, setInternalSort] = useState<SortState | null>(null)
  const [internalPage, setInternalPage] = useState(1)
  const [internalPageSize, setInternalPageSize] = useState(defaultPageSize)

  const activeSort = isSortControlled ? sort : internalSort

  // See the note at the top: sorting only the visible page of a server-paginated
  // list produces a convincing wrong answer, so it is not attempted.
  const sortsInternally = !isSortControlled && !pagination

  const sortedRows = useMemo(() => {
    if (!sortsInternally || !activeSort) return rows
    const column = columns.find((c) => c.id === activeSort.columnId)
    if (!column?.sortValue) return rows

    const direction = activeSort.direction === 'asc' ? 1 : -1
    // Copied before sorting: Array.prototype.sort mutates, and `rows` is very
    // often the array react-query is caching.
    return [...rows].sort(
      (a, b) => compareValues(column.sortValue!(a), column.sortValue!(b)) * direction,
    )
  }, [rows, columns, activeSort, sortsInternally])

  const paginatesInternally = !pagination && !disableInternalPagination
  const pageSize = pagination?.pageSize ?? internalPageSize
  const page = pagination?.page ?? internalPage

  const visibleRows = useMemo(() => {
    if (!paginatesInternally) return sortedRows
    const start = (page - 1) * pageSize
    return sortedRows.slice(start, start + pageSize)
  }, [sortedRows, paginatesInternally, page, pageSize])

  const total = pagination?.total ?? sortedRows.length
  const totalPages =
    pagination?.totalPages ?? Math.max(1, Math.ceil(total / Math.max(pageSize, 1)))

  const handleSort = (column: DataTableColumn<Row>) => {
    if (!column.sortable) return
    // Third click clears the sort rather than cycling back to ascending, so the
    // original order is always reachable.
    const next: SortState | null =
      activeSort?.columnId !== column.id
        ? { columnId: column.id, direction: 'asc' }
        : activeSort.direction === 'asc'
          ? { columnId: column.id, direction: 'desc' }
          : null

    if (isSortControlled) onSortChange?.(next)
    else setInternalSort(next)
    // A re-sort changes what page 1 contains, so staying on page 4 would show
    // an arbitrary slice of a newly ordered list.
    if (paginatesInternally) setInternalPage(1)
  }

  const changePage = (next: number) => {
    const clamped = Math.min(Math.max(next, 1), totalPages)
    if (pagination) pagination.onPageChange(clamped)
    else setInternalPage(clamped)
  }

  const changePageSize = (next: number) => {
    if (pagination?.onPageSizeChange) {
      pagination.onPageSizeChange(next)
      pagination.onPageChange(1)
    } else {
      setInternalPageSize(next)
      setInternalPage(1)
    }
  }

  const showPagination =
    (paginatesInternally && total > Math.min(...DEFAULT_PAGE_SIZES)) ||
    (pagination !== undefined && totalPages > 1) ||
    (pagination?.onPageSizeChange !== undefined)

  const firstOnPage = total === 0 ? 0 : (page - 1) * pageSize + 1
  const lastOnPage = Math.min(page * pageSize, total)

  return (
    <div className={cn('flex flex-col', className)}>
      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full min-w-[40rem] border-collapse text-sm">
          {caption && <caption className="sr-only">{caption}</caption>}

          <thead>
            <tr className="border-b border-border bg-muted/60">
              {columns.map((column) => {
                const isSorted = activeSort?.columnId === column.id
                const canSort = Boolean(column.sortable) && (sortsInternally || isSortControlled)

                return (
                  <th
                    key={column.id}
                    scope="col"
                    style={column.width ? { width: column.width } : undefined}
                    // aria-sort is what tells a screen reader the column is
                    // ordered and which way; the arrow alone is invisible to it.
                    aria-sort={
                      isSorted
                        ? activeSort!.direction === 'asc'
                          ? 'ascending'
                          : 'descending'
                        : canSort
                          ? 'none'
                          : undefined
                    }
                    className={cn(
                      'px-4 py-3 text-xs font-semibold tracking-normal text-muted-foreground',
                      'whitespace-nowrap uppercase',
                      alignmentClass(column as DataTableColumn<unknown>),
                      column.numeric && 'tabular-nums',
                      column.hideBelow && HIDE_BELOW[column.hideBelow],
                      column.headerClassName,
                    )}
                  >
                    {canSort ? (
                      <button
                        type="button"
                        onClick={() => handleSort(column)}
                        className={cn(
                          'group inline-flex items-center gap-1.5 rounded-sm transition-colors',
                          'hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1',
                          isSorted && 'text-foreground',
                        )}
                      >
                        <span>{column.header}</span>
                        {isSorted ? (
                          activeSort!.direction === 'asc' ? (
                            <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
                          ) : (
                            <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
                          )
                        ) : (
                          <ChevronsUpDown
                            className="h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-60"
                            aria-hidden="true"
                          />
                        )}
                      </button>
                    ) : (
                      column.header
                    )}
                  </th>
                )
              })}
            </tr>
          </thead>

          <tbody>
            {isLoading ? (
              // Skeleton rows rather than a centred spinner: the table keeps its
              // height, so the page does not jump when the data lands.
              Array.from({ length: Math.min(pageSize, 5) }).map((_, rowIndex) => (
                <tr key={`skeleton-${rowIndex}`} className="border-b border-border/60 last:border-0">
                  {columns.map((column) => (
                    <td
                      key={column.id}
                      className={cn(
                        'px-4 py-3.5',
                        column.hideBelow && HIDE_BELOW[column.hideBelow],
                      )}
                    >
                      <Skeleton className="h-4 w-full max-w-[8rem]" />
                    </td>
                  ))}
                </tr>
              ))
            ) : visibleRows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-16">
                  <div className="flex flex-col items-center gap-3 text-center">
                    <div className="rounded-full bg-muted p-3 text-muted-foreground">
                      {emptyIcon ?? <Inbox className="h-6 w-6" aria-hidden="true" />}
                    </div>
                    <p className="text-sm text-muted-foreground">{emptyMessage}</p>
                  </div>
                </td>
              </tr>
            ) : (
              visibleRows.map((row, index) => (
                <tr
                  key={getRowId(row)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={cn(
                    'border-b border-border/60 transition-colors last:border-0',
                    'hover:bg-muted/40',
                    onRowClick && 'cursor-pointer',
                    rowClassName?.(row, index),
                  )}
                >
                  {columns.map((column) => (
                    <td
                      key={column.id}
                      className={cn(
                        // 14px vertical: enough to separate rows without the
                        // airy look that makes a dense list hard to scan.
                        'px-4 py-3.5 align-middle text-foreground',
                        alignmentClass(column as DataTableColumn<unknown>),
                        column.numeric && 'tabular-nums',
                        column.hideBelow && HIDE_BELOW[column.hideBelow],
                        column.cellClassName,
                      )}
                    >
                      {column.cell(row, index)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showPagination && !isLoading && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground tabular-nums">
            {total === 0
              ? 'بدون نتیجه'
              : `نمایش ${formatNumber(firstOnPage)} تا ${formatNumber(lastOnPage)} از ${formatNumber(total)}`}
          </p>

          <div className="flex items-center gap-3">
            {(pagination?.onPageSizeChange || paginatesInternally) && (
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span>تعداد در صفحه</span>
                <select
                  value={pageSize}
                  onChange={(event) => changePageSize(Number(event.target.value))}
                  className="rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  {(pagination?.pageSizeOptions ?? DEFAULT_PAGE_SIZES).map((size) => (
                    <option key={size} value={size}>
                      {formatNumber(size)}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <Pager page={page} totalPages={totalPages} onChange={changePage} />
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Numbered pages, not just prev/next: position in a long list is information,
 * and "صفحه ۷ از ۴۰" with no way to reach page 20 is a dead end.
 *
 * The window is first, last, and the pages either side of the current one, with
 * ellipses for the gaps — so the control stays the same width regardless of how
 * many pages there are.
 */
function Pager({
  page,
  totalPages,
  onChange,
}: {
  page: number
  totalPages: number
  onChange: (page: number) => void
}) {
  if (totalPages <= 1) return null

  const pages: (number | 'gap')[] = []
  const push = (value: number | 'gap') => {
    if (value === 'gap' && pages[pages.length - 1] === 'gap') return
    pages.push(value)
  }

  for (let candidate = 1; candidate <= totalPages; candidate += 1) {
    const isEdge = candidate === 1 || candidate === totalPages
    const isNear = Math.abs(candidate - page) <= 1
    if (isEdge || isNear) push(candidate)
    else push('gap')
  }

  const buttonBase =
    'inline-flex h-8 min-w-8 items-center justify-center rounded-md border px-2 text-xs tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-40'

  return (
    <nav className="flex items-center gap-1" aria-label="صفحه‌بندی">
      <button
        type="button"
        onClick={() => onChange(page - 1)}
        disabled={page <= 1}
        className={cn(buttonBase, 'border-border bg-background hover:bg-muted')}
      >
        قبلی
      </button>

      {pages.map((entry, index) =>
        entry === 'gap' ? (
          <span key={`gap-${index}`} className="px-1 text-xs text-muted-foreground" aria-hidden="true">
            …
          </span>
        ) : (
          <button
            key={entry}
            type="button"
            onClick={() => onChange(entry)}
            aria-current={entry === page ? 'page' : undefined}
            className={cn(
              buttonBase,
              entry === page
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-background hover:bg-muted',
            )}
          >
            {formatNumber(entry)}
          </button>
        ),
      )}

      <button
        type="button"
        onClick={() => onChange(page + 1)}
        disabled={page >= totalPages}
        className={cn(buttonBase, 'border-border bg-background hover:bg-muted')}
      >
        بعدی
      </button>
    </nav>
  )
}
