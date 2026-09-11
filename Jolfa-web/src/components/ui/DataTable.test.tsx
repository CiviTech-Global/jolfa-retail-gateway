import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { DataTable, type DataTableColumn } from './DataTable'

interface Row {
  id: string
  name: string
  price: number
  active: boolean
}

const rows: Row[] = [
  { id: '1', name: 'پوشک', price: 300, active: true },
  { id: '2', name: 'شامپو', price: 100, active: false },
  { id: '3', name: 'آبمیوه', price: 200, active: true },
]

const columns: DataTableColumn<Row>[] = [
  { id: 'name', header: 'نام', sortable: true, sortValue: (r) => r.name, cell: (r) => r.name },
  {
    id: 'price',
    header: 'قیمت',
    numeric: true,
    sortable: true,
    sortValue: (r) => r.price,
    cell: (r) => String(r.price),
  },
  { id: 'active', header: 'وضعیت', cell: (r) => (r.active ? 'فعال' : 'غیرفعال') },
]

/** Body cell text, top to bottom, for one column. */
function columnValues(columnIndex: number): string[] {
  const body = screen.getAllByRole('rowgroup')[1]
  return within(body)
    .getAllByRole('row')
    .map((row) => within(row).getAllByRole('cell')[columnIndex].textContent?.trim() ?? '')
}

function renderTable(props: Partial<React.ComponentProps<typeof DataTable<Row>>> = {}) {
  return render(
    <DataTable<Row> columns={columns} rows={rows} getRowId={(row) => row.id} {...props} />,
  )
}

describe('DataTable', () => {
  describe('uncontrolled sorting', () => {
    it('sorts ascending on first click and descending on second', () => {
      renderTable()
      const header = screen.getByRole('button', { name: /قیمت/ })

      fireEvent.click(header)
      expect(columnValues(1)).toEqual(['100', '200', '300'])

      fireEvent.click(header)
      expect(columnValues(1)).toEqual(['300', '200', '100'])
    })

    it('clears the sort on the third click, restoring the original order', () => {
      // Without this the original ordering — which for most lists is a
      // meaningful display order — becomes unreachable once you sort.
      renderTable()
      const header = screen.getByRole('button', { name: /قیمت/ })

      fireEvent.click(header)
      fireEvent.click(header)
      fireEvent.click(header)

      expect(columnValues(1)).toEqual(['300', '100', '200'])
    })

    it('sorts Persian text in Persian alphabetical order', () => {
      // Code-point order would put these in a different, meaningless sequence;
      // the comparator asks for the `fa` collation explicitly.
      renderTable()
      fireEvent.click(screen.getByRole('button', { name: /نام/ }))

      expect(columnValues(0)).toEqual(['آبمیوه', 'پوشک', 'شامپو'])
    })

    it('does not mutate the rows array it was given', () => {
      // `rows` is usually the array react-query holds in its cache; sorting it
      // in place would reorder every other consumer's copy.
      const original = [...rows]
      renderTable()
      fireEvent.click(screen.getByRole('button', { name: /قیمت/ }))

      expect(rows).toEqual(original)
    })

    it('reports sort state to assistive technology via aria-sort', () => {
      renderTable()
      const priceHeader = screen.getByRole('columnheader', { name: /قیمت/ })
      expect(priceHeader).toHaveAttribute('aria-sort', 'none')

      fireEvent.click(screen.getByRole('button', { name: /قیمت/ }))
      expect(priceHeader).toHaveAttribute('aria-sort', 'ascending')
    })

    it('leaves non-sortable columns without a sort control', () => {
      renderTable()
      expect(screen.queryByRole('button', { name: /وضعیت/ })).not.toBeInTheDocument()
    })
  })

  describe('controlled sorting', () => {
    it('reports intent without reordering the rows itself', () => {
      // The server owns the order here. If the table also sorted locally it
      // would reorder the current page and then be overwritten by the refetch.
      const onSortChange = vi.fn()
      renderTable({
        sort: null,
        onSortChange,
        pagination: { page: 1, pageSize: 10, total: 3, totalPages: 1, onPageChange: vi.fn() },
      })

      fireEvent.click(screen.getByRole('button', { name: /قیمت/ }))

      expect(onSortChange).toHaveBeenCalledWith({ columnId: 'price', direction: 'asc' })
      expect(columnValues(1)).toEqual(['300', '100', '200'])
    })
  })

  describe('pagination', () => {
    const many: Row[] = Array.from({ length: 25 }, (_, i) => ({
      id: String(i),
      name: `کالا ${i}`,
      price: i,
      active: true,
    }))

    it('shows only one page at a time and moves between pages', () => {
      render(
        <DataTable<Row>
          columns={columns}
          rows={many}
          getRowId={(row) => row.id}
          defaultPageSize={10}
        />,
      )

      expect(columnValues(1)).toHaveLength(10)
      expect(columnValues(1)[0]).toBe('0')

      fireEvent.click(screen.getByRole('button', { name: 'بعدی' }))
      expect(columnValues(1)[0]).toBe('10')
    })

    it('returns to the first page when the sort changes', () => {
      // Page 3 of an old ordering is an arbitrary slice of the new one.
      render(
        <DataTable<Row>
          columns={columns}
          rows={many}
          getRowId={(row) => row.id}
          defaultPageSize={10}
        />,
      )

      fireEvent.click(screen.getByRole('button', { name: 'بعدی' }))
      fireEvent.click(screen.getByRole('button', { name: /قیمت/ }))

      expect(columnValues(1)[0]).toBe('0')
    })

    it('does not paginate when told not to', () => {
      render(
        <DataTable<Row>
          columns={columns}
          rows={many}
          getRowId={(row) => row.id}
          disableInternalPagination
        />,
      )

      expect(columnValues(1)).toHaveLength(25)
      expect(screen.queryByRole('navigation', { name: 'صفحه‌بندی' })).not.toBeInTheDocument()
    })

    it('delegates paging to the caller when controlled', () => {
      const onPageChange = vi.fn()
      renderTable({
        pagination: { page: 2, pageSize: 10, total: 25, totalPages: 3, onPageChange },
      })

      fireEvent.click(screen.getByRole('button', { name: 'بعدی' }))
      expect(onPageChange).toHaveBeenCalledWith(3)
    })
  })

  describe('states', () => {
    it('shows the empty message rather than a bare table', () => {
      renderTable({ rows: [], emptyMessage: 'چیزی نیست.' })
      expect(screen.getByText('چیزی نیست.')).toBeInTheDocument()
    })

    it('shows placeholder rows while loading, keeping the table height', () => {
      renderTable({ isLoading: true })
      expect(screen.queryByText('پوشک')).not.toBeInTheDocument()
      const body = screen.getAllByRole('rowgroup')[1]
      expect(within(body).getAllByRole('row').length).toBeGreaterThan(0)
    })
  })

  it('right-aligns numeric columns and gives them tabular figures', () => {
    // Proportional digits make every number a different width, so a column of
    // prices cannot be compared down the page. This is the detail that makes a
    // table read as data rather than as a list of strings.
    renderTable()
    const body = screen.getAllByRole('rowgroup')[1]
    const priceCell = within(within(body).getAllByRole('row')[0]).getAllByRole('cell')[1]

    expect(priceCell.className).toContain('tabular-nums')
    expect(priceCell.className).toContain('text-end')
  })
})
