import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { AdminRoute } from './AdminRoute'
import { ProtectedRoute } from './ProtectedRoute'
import type { User } from '@/features/auth/types'

// The guards read only `useAuth()`, so the context is stubbed directly rather
// than driven through a real provider and network round-trip.
const useAuthMock = vi.fn()
vi.mock('@/features/auth/context', () => ({ useAuth: () => useAuthMock() }))

const customer: User = {
  id: 'user-1',
  email: null,
  phone: '09120000001',
  firstName: null,
  lastName: null,
  role: 'CUSTOMER',
  isActive: true,
}
const admin: User = { ...customer, id: 'admin-1', role: 'ADMIN' }

type AuthState = { user: User | null; isAuthenticated: boolean; isLoading: boolean }

const loading: AuthState = { user: null, isAuthenticated: false, isLoading: true }
const guest: AuthState = { user: null, isAuthenticated: false, isLoading: false }
const asCustomer: AuthState = { user: customer, isAuthenticated: true, isLoading: false }
const asAdmin: AuthState = { user: admin, isAuthenticated: true, isLoading: false }

/** Renders `guard` at /secret with recognisable landing pages at / and /login. */
function renderGuard(guard: React.ReactNode, state: AuthState) {
  useAuthMock.mockReturnValue(state)
  return render(
    <MemoryRouter initialEntries={['/secret']}>
      <Routes>
        <Route path="/secret" element={guard} />
        <Route path="/login" element={<p>login page</p>} />
        <Route path="/" element={<p>home page</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

const secret = <p>secret content</p>

describe('ProtectedRoute', () => {
  it('shows a loading state while the session is resolving', () => {
    renderGuard(<ProtectedRoute>{secret}</ProtectedRoute>, loading)

    expect(screen.getByText('در حال بارگذاری ...')).toBeInTheDocument()
    expect(screen.queryByText('secret content')).not.toBeInTheDocument()
  })

  it('does NOT redirect while still loading — that would race the bootstrap', () => {
    renderGuard(<ProtectedRoute>{secret}</ProtectedRoute>, loading)

    expect(screen.queryByText('login page')).not.toBeInTheDocument()
  })

  it('redirects a guest to /login', () => {
    renderGuard(<ProtectedRoute>{secret}</ProtectedRoute>, guest)

    expect(screen.getByText('login page')).toBeInTheDocument()
    expect(screen.queryByText('secret content')).not.toBeInTheDocument()
  })

  it('renders children for an authenticated customer', () => {
    renderGuard(<ProtectedRoute>{secret}</ProtectedRoute>, asCustomer)

    expect(screen.getByText('secret content')).toBeInTheDocument()
  })

  it('renders children for an admin as well', () => {
    renderGuard(<ProtectedRoute>{secret}</ProtectedRoute>, asAdmin)

    expect(screen.getByText('secret content')).toBeInTheDocument()
  })
})

describe('AdminRoute', () => {
  it('shows a loading state while the session is resolving', () => {
    renderGuard(<AdminRoute>{secret}</AdminRoute>, loading)

    expect(screen.getByText('در حال بارگذاری ...')).toBeInTheDocument()
    expect(screen.queryByText('secret content')).not.toBeInTheDocument()
  })

  it('does NOT redirect while still loading', () => {
    renderGuard(<AdminRoute>{secret}</AdminRoute>, loading)

    expect(screen.queryByText('home page')).not.toBeInTheDocument()
  })

  it('redirects a guest to the home page', () => {
    renderGuard(<AdminRoute>{secret}</AdminRoute>, guest)

    expect(screen.getByText('home page')).toBeInTheDocument()
    expect(screen.queryByText('secret content')).not.toBeInTheDocument()
  })

  /** The central client-side role boundary: signed in is not enough. */
  it('redirects an authenticated CUSTOMER away from admin content', () => {
    renderGuard(<AdminRoute>{secret}</AdminRoute>, asCustomer)

    expect(screen.getByText('home page')).toBeInTheDocument()
    expect(screen.queryByText('secret content')).not.toBeInTheDocument()
  })

  it('renders children for an ADMIN', () => {
    renderGuard(<AdminRoute>{secret}</AdminRoute>, asAdmin)

    expect(screen.getByText('secret content')).toBeInTheDocument()
  })

  it('redirects when isAuthenticated is true but the user object is missing', () => {
    renderGuard(<AdminRoute>{secret}</AdminRoute>, {
      user: null,
      isAuthenticated: true,
      isLoading: false,
    })

    expect(screen.getByText('home page')).toBeInTheDocument()
  })
})
