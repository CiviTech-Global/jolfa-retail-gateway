import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { AuthProvider, useAuth } from './context'
import type { AuthResponse, User } from './types'

// All network access in this context goes through these two modules.
vi.mock('./api', () => ({
  login: vi.fn(),
  register: vi.fn(),
  getMe: vi.fn(),
}))
vi.mock('@/api/client', () => ({ apiRequest: vi.fn().mockResolvedValue(undefined) }))

const api = await import('./api')
const TOKEN_KEY = 'token'

const customer: User = {
  id: 'user-1',
  email: 'a@b.c',
  phone: '09120000001',
  firstName: 'علی',
  lastName: 'رضایی',
  role: 'CUSTOMER',
  isActive: true,
}

function authResponse(user: User = customer): AuthResponse {
  return { user, tokens: { accessToken: 'access-token', refreshToken: 'refresh-token' } }
}

function wrapper({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>
}

async function renderAuth() {
  const rendered = renderHook(() => useAuth(), { wrapper })
  await waitFor(() => expect(rendered.result.current.isLoading).toBe(false))
  return rendered
}

beforeEach(() => {
  vi.mocked(api.getMe).mockReset()
  vi.mocked(api.login).mockReset()
  vi.mocked(api.register).mockReset()
})

describe('useAuth() outside a provider', () => {
  it('throws a helpful error', () => {
    expect(() => renderHook(() => useAuth())).toThrow(/must be used within an AuthProvider/)
  })
})

describe('AuthProvider — bootstrap', () => {
  it('settles unauthenticated with no stored token, without calling /auth/me', async () => {
    const { result } = await renderAuth()

    expect(result.current.user).toBeNull()
    expect(result.current.isAuthenticated).toBe(false)
    expect(api.getMe).not.toHaveBeenCalled()
  })

  it('restores the session from a stored token', async () => {
    localStorage.setItem(TOKEN_KEY, 'stored-token')
    vi.mocked(api.getMe).mockResolvedValue({ user: customer })

    const { result } = await renderAuth()

    expect(api.getMe).toHaveBeenCalledOnce()
    expect(result.current.user).toEqual(customer)
    expect(result.current.isAuthenticated).toBe(true)
  })

  /**
   * A stale/expired token must not leave the app stuck on the loading screen,
   * and the dead token must be discarded rather than resent on every request.
   */
  it('drops the stored token and settles when /auth/me rejects', async () => {
    localStorage.setItem(TOKEN_KEY, 'expired-token')
    vi.mocked(api.getMe).mockRejectedValue(new Error('401'))

    const { result } = await renderAuth()

    expect(result.current.user).toBeNull()
    expect(result.current.isAuthenticated).toBe(false)
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull()
  })

  it('does not hang in isLoading after a failed bootstrap', async () => {
    localStorage.setItem(TOKEN_KEY, 'expired-token')
    vi.mocked(api.getMe).mockRejectedValue(new Error('401'))

    const { result } = await renderAuth()

    expect(result.current.isLoading).toBe(false)
  })
})

describe('AuthProvider — login', () => {
  it('stores the access token and sets the user', async () => {
    vi.mocked(api.login).mockResolvedValue(authResponse())
    const { result } = await renderAuth()

    await act(async () => {
      await result.current.login({ phone: '09120000001', password: 'password123' })
    })

    expect(api.login).toHaveBeenCalledWith({ phone: '09120000001', password: 'password123' })
    expect(localStorage.getItem(TOKEN_KEY)).toBe('access-token')
    expect(result.current.user).toEqual(customer)
    expect(result.current.isAuthenticated).toBe(true)
  })

  it('propagates a login failure and leaves the session signed out', async () => {
    vi.mocked(api.login).mockRejectedValue(new Error('bad credentials'))
    const { result } = await renderAuth()

    await expect(
      act(async () => {
        await result.current.login({ phone: '09120000001', password: 'wrong' })
      }),
    ).rejects.toThrow('bad credentials')

    expect(localStorage.getItem(TOKEN_KEY)).toBeNull()
    expect(result.current.isAuthenticated).toBe(false)
  })

  it('exposes an ADMIN role on the session user', async () => {
    const admin: User = { ...customer, id: 'admin-1', role: 'ADMIN' }
    vi.mocked(api.login).mockResolvedValue(authResponse(admin))
    const { result } = await renderAuth()

    await act(async () => {
      await result.current.login({ phone: '09120000000', password: 'admin123' })
    })

    expect(result.current.user?.role).toBe('ADMIN')
  })
})

describe('AuthProvider — register', () => {
  it('signs the new account straight in', async () => {
    vi.mocked(api.register).mockResolvedValue(authResponse())
    const { result } = await renderAuth()

    await act(async () => {
      await result.current.register({ phone: '09120000001', password: 'password123' })
    })

    expect(localStorage.getItem(TOKEN_KEY)).toBe('access-token')
    expect(result.current.isAuthenticated).toBe(true)
  })

  it('propagates a registration failure without signing in', async () => {
    vi.mocked(api.register).mockRejectedValue(new Error('duplicate phone'))
    const { result } = await renderAuth()

    await expect(
      act(async () => {
        await result.current.register({ phone: '09120000001', password: 'password123' })
      }),
    ).rejects.toThrow('duplicate phone')

    expect(result.current.isAuthenticated).toBe(false)
  })
})

describe('AuthProvider — logout', () => {
  it('clears both the token and the user', async () => {
    vi.mocked(api.login).mockResolvedValue(authResponse())
    const { result } = await renderAuth()
    await act(async () => {
      await result.current.login({ phone: '09120000001', password: 'password123' })
    })

    act(() => result.current.logout())

    expect(localStorage.getItem(TOKEN_KEY)).toBeNull()
    expect(result.current.user).toBeNull()
    expect(result.current.isAuthenticated).toBe(false)
  })

  it('still signs out locally even if the logout request fails', async () => {
    const { apiRequest } = await import('@/api/client')
    vi.mocked(apiRequest).mockRejectedValueOnce(new Error('network down'))
    vi.mocked(api.login).mockResolvedValue(authResponse())
    const { result } = await renderAuth()
    await act(async () => {
      await result.current.login({ phone: '09120000001', password: 'password123' })
    })

    act(() => result.current.logout())

    expect(result.current.isAuthenticated).toBe(false)
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull()
  })
})
