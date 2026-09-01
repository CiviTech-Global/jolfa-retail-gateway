import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { AppProviders } from '@/providers'
import { AdminLayout } from './AdminLayout'

function renderAdmin(initialPath = '/admin') {
  return render(
    <AppProviders>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<div>محتوای داشبورد</div>} />
            <Route path="products" element={<div>محصولات</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </AppProviders>,
  )
}

describe('AdminLayout', () => {
  it('renders without a missing-provider crash', () => {
    // Regression: the sidebar's Tooltip threw "`Tooltip` must be used within
    // `TooltipProvider`" because no provider was mounted anywhere in the app.
    expect(() => renderAdmin()).not.toThrow()
    expect(screen.getByText('محتوای داشبورد')).toBeInTheDocument()
  })

  it('collapses and restores the sidebar, persisting the choice', () => {
    renderAdmin()

    // Expanded by default: the brand label and nav text are visible.
    expect(screen.getByRole('link', { name: 'پنل مدیریت' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'جمع کردن منو' }))

    expect(screen.queryByRole('link', { name: 'پنل مدیریت' })).not.toBeInTheDocument()
    expect(localStorage.getItem('admin.sidebar.collapsed')).toBe('true')

    fireEvent.click(screen.getByRole('button', { name: 'باز کردن منو' }))

    expect(screen.getByRole('link', { name: 'پنل مدیریت' })).toBeInTheDocument()
    expect(localStorage.getItem('admin.sidebar.collapsed')).toBe('false')
  })

  it('restores the collapsed preference on mount', () => {
    localStorage.setItem('admin.sidebar.collapsed', 'true')
    renderAdmin()
    expect(screen.getByRole('button', { name: 'باز کردن منو' })).toBeInTheDocument()
  })

  it('marks only the current route as active', () => {
    renderAdmin('/admin/products')

    // Scoped to the sidebar: breadcrumbs link to داشبورد as well.
    const sidebar = within(screen.getByRole('navigation', { name: 'منوی اصلی' }))
    const dashboard = sidebar.getByRole('link', { name: 'داشبورد' })
    const products = sidebar.getByRole('link', { name: 'محصولات' })

    // Regression: the old startsWith('/admin') check lit up داشبورد everywhere.
    expect(dashboard).not.toHaveAttribute('aria-current')
    expect(products).toHaveAttribute('aria-current', 'page')
  })
})
