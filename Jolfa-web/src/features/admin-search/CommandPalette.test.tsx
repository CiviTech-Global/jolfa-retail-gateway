import { describe, expect, it, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { CommandPalette } from './CommandPalette'
import * as api from './api'

/**
 * The palette replaces a header input that was markup only — no state, no
 * handler, no request. These cover the behaviour that made it worth building:
 * the shortcuts are usable before any result arrives, and the query is debounced
 * rather than fired per keystroke.
 */
function renderPalette(onClose = vi.fn()) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <CommandPalette onClose={onClose} />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const emptyResult: api.AdminSearchResult = { query: '', groups: [], tookMs: 1 }

beforeEach(() => {
  localStorage.clear()
})

describe('CommandPalette', () => {
  it('lists the shortcuts before anything is typed, so it is useful immediately', () => {
    renderPalette()

    expect(screen.getByText('محصول جدید')).toBeInTheDocument()
    expect(screen.getByText('تغییر گروهی قیمت')).toBeInTheDocument()
  })

  it('filters shortcuts locally, with no request', () => {
    const search = vi.spyOn(api, 'searchAdmin').mockResolvedValue(emptyResult)
    renderPalette()

    fireEvent.change(screen.getByLabelText('جستجوی سریع'), { target: { value: 'قیمت' } })

    expect(screen.getByText('تغییر گروهی قیمت')).toBeInTheDocument()
    expect(screen.queryByText('سفارش‌ها')).not.toBeInTheDocument()
    // Local matching must not wait on the network.
    expect(search).not.toHaveBeenCalled()
  })

  it('matches a shortcut by its English keyword, for a Latin keyboard', () => {
    renderPalette()

    fireEvent.change(screen.getByLabelText('جستجوی سریع'), { target: { value: 'discount' } })

    expect(screen.getByText('تغییر گروهی قیمت')).toBeInTheDocument()
  })

  it('does not search on a single character', async () => {
    const search = vi.spyOn(api, 'searchAdmin').mockResolvedValue(emptyResult)
    renderPalette()

    fireEvent.change(screen.getByLabelText('جستجوی سریع'), { target: { value: 'ش' } })

    // One character matches almost everything and is never what was meant.
    await new Promise((resolve) => setTimeout(resolve, 300))
    expect(search).not.toHaveBeenCalled()
  })

  it('debounces typing into a single request', async () => {
    const search = vi.spyOn(api, 'searchAdmin').mockResolvedValue(emptyResult)
    renderPalette()
    const input = screen.getByLabelText('جستجوی سریع')

    for (const value of ['شا', 'شام', 'شامپ', 'شامپو']) {
      fireEvent.change(input, { target: { value } })
    }

    await waitFor(() => expect(search).toHaveBeenCalledTimes(1))
    expect(search).toHaveBeenCalledWith('شامپو')
  })

  it('shows server results grouped under their entity', async () => {
    vi.spyOn(api, 'searchAdmin').mockResolvedValue({
      query: 'شامپو',
      tookMs: 4,
      groups: [
        {
          entity: 'product',
          total: 1,
          seeAllUrl: '/admin/products?q=شامپو',
          hits: [
            { id: 'p1', title: 'شامپو ضد شوره', subtitle: 'مراقبت مو', url: '/admin/products/x/edit' },
          ],
        },
      ],
    })

    renderPalette()
    fireEvent.change(screen.getByLabelText('جستجوی سریع'), { target: { value: 'شامپو' } })

    expect(await screen.findByText('شامپو ضد شوره')).toBeInTheDocument()
    expect(screen.getByText('محصولات')).toBeInTheDocument()
  })

  it('says so when nothing matches, rather than showing an empty list', async () => {
    vi.spyOn(api, 'searchAdmin').mockResolvedValue({ query: 'قطعا نیست', groups: [], tookMs: 2 })
    renderPalette()

    fireEvent.change(screen.getByLabelText('جستجوی سریع'), { target: { value: 'قطعا نیست' } })

    expect(await screen.findByText(/پیدا نشد/)).toBeInTheDocument()
  })

  it('closes on Escape', () => {
    const onClose = vi.fn()
    renderPalette(onClose)

    fireEvent.keyDown(screen.getByLabelText('جستجوی سریع'), { key: 'Escape' })

    expect(onClose).toHaveBeenCalled()
  })

  it('moves the highlight with the arrow keys', () => {
    renderPalette()
    const input = screen.getByLabelText('جستجوی سریع')

    const firstRow = screen.getByText('محصول جدید').closest('button')
    expect(firstRow).toHaveAttribute('data-active', 'true')

    fireEvent.keyDown(input, { key: 'ArrowDown' })

    expect(firstRow).toHaveAttribute('data-active', 'false')
  })

  it('opens the highlighted row on Enter', () => {
    const onClose = vi.fn()
    renderPalette(onClose)

    fireEvent.keyDown(screen.getByLabelText('جستجوی سریع'), { key: 'Enter' })

    // Navigation is what closes the palette.
    expect(onClose).toHaveBeenCalled()
  })

  it('remembers a chosen destination for next time', () => {
    const { unmount } = renderPalette()
    fireEvent.click(screen.getByText('تغییر گروهی قیمت'))
    unmount()

    renderPalette()

    expect(screen.getByText('اخیر')).toBeInTheDocument()
  })

  it('survives unreadable localStorage instead of failing to open', () => {
    // A private window, or cleared site data, both throw here. Recents are a
    // convenience; losing them must never stop the palette rendering.
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied')
    })

    renderPalette()

    expect(screen.getByLabelText('جستجوی سریع')).toBeInTheDocument()
  })
})
