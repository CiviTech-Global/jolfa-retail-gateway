import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from './client'
import { clearTokens, getAccessToken, getRefreshToken, setTokens } from './tokens'

/**
 * The silent-refresh path. Before this existed the client held a 24-hour access
 * token with no way to renew it, so a session simply stopped working.
 */

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const ok = (data: unknown) => jsonResponse({ success: true, data })
const unauthorized = () =>
  jsonResponse({ success: false, error: { code: 'UNAUTHORIZED', message: 'نامعتبر' } }, 401)

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  localStorage.clear()
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
  localStorage.clear()
})

describe('apiRequest', () => {
  it('attaches the stored access token', async () => {
    setTokens({ accessToken: 'access-1', refreshToken: 'refresh-1' })
    fetchMock.mockResolvedValueOnce(ok({ user: { id: '1' } }))

    await apiRequest('/auth/me')

    const headers = fetchMock.mock.calls[0][1].headers as Headers
    expect(headers.get('Authorization')).toBe('Bearer access-1')
  })

  it('refreshes once on a 401 and replays the original request', async () => {
    setTokens({ accessToken: 'stale', refreshToken: 'refresh-1' })

    fetchMock
      .mockResolvedValueOnce(unauthorized())
      .mockResolvedValueOnce(ok({ tokens: { accessToken: 'access-2', refreshToken: 'refresh-2' } }))
      .mockResolvedValueOnce(ok({ user: { id: '1' } }))

    const result = await apiRequest<{ user: { id: string } }>('/auth/me')

    expect(result.user.id).toBe('1')
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(fetchMock.mock.calls[1][0]).toContain('/auth/refresh')

    // The rotated pair replaced the old one.
    expect(getAccessToken()).toBe('access-2')
    expect(getRefreshToken()).toBe('refresh-2')

    // The replay carries the new token, not the stale one.
    const replayHeaders = fetchMock.mock.calls[2][1].headers as Headers
    expect(replayHeaders.get('Authorization')).toBe('Bearer access-2')
  })

  it('gives up after one refresh rather than looping', async () => {
    setTokens({ accessToken: 'stale', refreshToken: 'refresh-1' })

    fetchMock
      .mockResolvedValueOnce(unauthorized())
      .mockResolvedValueOnce(ok({ tokens: { accessToken: 'access-2', refreshToken: 'refresh-2' } }))
      .mockResolvedValueOnce(unauthorized())

    await expect(apiRequest('/auth/me')).rejects.toThrow()
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('clears the session when the refresh token is rejected', async () => {
    setTokens({ accessToken: 'stale', refreshToken: 'revoked' })

    fetchMock.mockResolvedValueOnce(unauthorized()).mockResolvedValueOnce(unauthorized())

    await expect(apiRequest('/auth/me')).rejects.toThrow()
    expect(getAccessToken()).toBeNull()
    expect(getRefreshToken()).toBeNull()
  })

  it('does not try to refresh when there is no refresh token', async () => {
    fetchMock.mockResolvedValueOnce(unauthorized())

    await expect(apiRequest('/products')).rejects.toThrow()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('does not refresh a failed login — that 401 is the real answer', async () => {
    setTokens({ accessToken: 'stale', refreshToken: 'refresh-1' })
    fetchMock.mockResolvedValueOnce(unauthorized())

    await expect(
      apiRequest('/auth/login', { method: 'POST', body: { phone: '0912', password: 'wrong' } }),
    ).rejects.toThrow()

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('shares a single refresh across concurrent requests', async () => {
    // Several queries firing at once must not each rotate the token.
    setTokens({ accessToken: 'stale', refreshToken: 'refresh-1' })

    fetchMock.mockImplementation((url: string) => {
      if (String(url).includes('/auth/refresh')) {
        return Promise.resolve(
          ok({ tokens: { accessToken: 'access-2', refreshToken: 'refresh-2' } }),
        )
      }
      return Promise.resolve(getAccessToken() === 'access-2' ? ok({ fine: true }) : unauthorized())
    })

    await Promise.all([apiRequest('/a'), apiRequest('/b'), apiRequest('/c')])

    const refreshCalls = fetchMock.mock.calls.filter((c) =>
      String(c[0]).includes('/auth/refresh'),
    )
    expect(refreshCalls).toHaveLength(1)
  })

  it('keeps the session on a network failure during refresh', async () => {
    // A dropped connection is not proof the session is invalid.
    setTokens({ accessToken: 'stale', refreshToken: 'refresh-1' })

    fetchMock
      .mockResolvedValueOnce(unauthorized())
      .mockRejectedValueOnce(new TypeError('network down'))

    await expect(apiRequest('/auth/me')).rejects.toThrow()
    expect(getRefreshToken()).toBe('refresh-1')
  })
})

describe('token storage', () => {
  it('survives localStorage being unavailable', () => {
    const original = Storage.prototype.setItem
    Storage.prototype.setItem = () => {
      throw new Error('QuotaExceededError')
    }

    // Private-mode Safari throws here; the app must not crash on sign-in.
    expect(() => setTokens({ accessToken: 'a', refreshToken: 'b' })).not.toThrow()

    Storage.prototype.setItem = original
  })

  it('clears both halves of the session together', () => {
    setTokens({ accessToken: 'a', refreshToken: 'b' })
    clearTokens()
    expect(getAccessToken()).toBeNull()
    expect(getRefreshToken()).toBeNull()
  })
})
