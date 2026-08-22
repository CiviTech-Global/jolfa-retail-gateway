import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from './client'
import { ApiError } from './errors'

const BASE = 'http://localhost:3001/api/v1'

/** Builds a Response-like stub for the global fetch mock. */
function jsonResponse(status: number, body: unknown, ok = status < 400) {
  return {
    ok,
    status,
    statusText: status === 500 ? 'Internal Server Error' : 'Error',
    json: async () => body,
  } as Response
}

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('apiRequest() — request shaping', () => {
  it('prefixes the configured API base and normalises a missing leading slash', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { success: true, data: { ok: 1 } }))

    await apiRequest('products')

    expect(fetchMock.mock.calls[0][0]).toBe(`${BASE}/products`)
  })

  it('does not double the slash when the path already has one', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { success: true, data: null }))

    await apiRequest('/products')

    expect(fetchMock.mock.calls[0][0]).toBe(`${BASE}/products`)
  })

  it('unwraps the { success, data } envelope and returns data only', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(200, { success: true, data: { products: [{ id: '1' }] } }),
    )

    const result = await apiRequest<{ products: { id: string }[] }>('/products')

    expect(result).toEqual({ products: [{ id: '1' }] })
  })

  it('JSON-encodes the body and sets Content-Type when a body is present', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { success: true, data: null }))

    await apiRequest('/orders', { method: 'POST', body: { items: [1, 2] } })

    const init = fetchMock.mock.calls[0][1] as RequestInit
    expect(init.body).toBe(JSON.stringify({ items: [1, 2] }))
    expect((init.headers as Headers).get('Content-Type')).toBe('application/json')
  })

  it('omits Content-Type when there is no body', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { success: true, data: null }))

    await apiRequest('/products')

    const init = fetchMock.mock.calls[0][1] as RequestInit
    expect(init.body).toBeUndefined()
    expect((init.headers as Headers).get('Content-Type')).toBeNull()
  })

  it('always requests JSON via the Accept header', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { success: true, data: null }))

    await apiRequest('/products')

    expect((fetchMock.mock.calls[0][1] as RequestInit).headers as Headers).toBeInstanceOf(Headers)
    expect(((fetchMock.mock.calls[0][1] as RequestInit).headers as Headers).get('Accept')).toBe(
      'application/json',
    )
  })

  it('attaches the stored bearer token when one is present', async () => {
    localStorage.setItem('token', 'jwt-abc')
    fetchMock.mockResolvedValue(jsonResponse(200, { success: true, data: null }))

    await apiRequest('/auth/me')

    expect(((fetchMock.mock.calls[0][1] as RequestInit).headers as Headers).get('Authorization'))
      .toBe('Bearer jwt-abc')
  })

  it('sends no Authorization header when no token is stored', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { success: true, data: null }))

    await apiRequest('/products')

    expect(((fetchMock.mock.calls[0][1] as RequestInit).headers as Headers).get('Authorization'))
      .toBeNull()
  })

  it('does not overwrite an explicitly supplied Authorization header', async () => {
    localStorage.setItem('token', 'stored-token')
    fetchMock.mockResolvedValue(jsonResponse(200, { success: true, data: null }))

    await apiRequest('/products', { headers: { Authorization: 'Bearer explicit' } })

    expect(((fetchMock.mock.calls[0][1] as RequestInit).headers as Headers).get('Authorization'))
      .toBe('Bearer explicit')
  })

  it('returns undefined for a 204 without parsing a body', async () => {
    const noBody = { ok: true, status: 204, json: async () => { throw new Error('no body') } }
    fetchMock.mockResolvedValue(noBody as unknown as Response)

    await expect(apiRequest('/things/1', { method: 'DELETE' })).resolves.toBeUndefined()
  })
})

describe('apiRequest() — error handling', () => {
  it('throws an ApiError carrying the HTTP status', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(404, { success: false, error: { code: 'NOT_FOUND', message: 'یافت نشد' } }),
    )

    await expect(apiRequest('/products/nope')).rejects.toBeInstanceOf(ApiError)
    await expect(apiRequest('/products/nope')).rejects.toMatchObject({ status: 404 })
  })

  /**
   * Regression: the server's error envelope is
   * `{ success: false, error: { code, message } }`, so the human-readable
   * Persian message is NESTED. Reading it off the top level produced the
   * generic fallback for every failed request.
   */
  it('surfaces the server message and code from the nested error envelope', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(409, {
        success: false,
        error: { code: 'CONFLICT', message: 'موجودی کافی نیست' },
      }),
    )

    await expect(apiRequest('/orders', { method: 'POST', body: {} })).rejects.toMatchObject({
      status: 409,
      code: 'CONFLICT',
      message: 'موجودی کافی نیست',
    })
  })

  it('exposes validation details as fieldErrors', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(422, {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'اطلاعات ورودی معتبر نیست',
          details: { phone: ['شماره تماس کوتاه است'] },
        },
      }),
    )

    await expect(apiRequest('/auth/register', { method: 'POST', body: {} })).rejects.toMatchObject({
      status: 422,
      code: 'VALIDATION_ERROR',
      fieldErrors: { phone: ['شماره تماس کوتاه است'] },
    })
  })

  it('falls back to the status text when the error body is not JSON', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      json: async () => {
        throw new Error('not json')
      },
    } as unknown as Response)

    await expect(apiRequest('/boom')).rejects.toMatchObject({
      status: 500,
      message: 'Internal Server Error',
    })
  })

  it('propagates a network-level fetch rejection unchanged', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))

    await expect(apiRequest('/products')).rejects.toThrow('Failed to fetch')
  })
})

describe('ApiError.fromResponse()', () => {
  it('reads a flat { message, code, errors } payload', () => {
    const error = ApiError.fromResponse(400, {
      message: 'flat message',
      code: 'FLAT',
      errors: { a: ['b'] },
    })

    expect(error).toMatchObject({
      status: 400,
      message: 'flat message',
      code: 'FLAT',
      fieldErrors: { a: ['b'] },
    })
  })

  it('reads the nested { error: { message, code } } server envelope', () => {
    const error = ApiError.fromResponse(403, {
      success: false,
      error: { code: 'FORBIDDEN', message: 'دسترسی ندارید' },
    })

    expect(error).toMatchObject({ status: 403, code: 'FORBIDDEN', message: 'دسترسی ندارید' })
  })

  it('accepts a bare string payload', () => {
    expect(ApiError.fromResponse(400, 'plain text problem')).toMatchObject({
      status: 400,
      message: 'plain text problem',
    })
  })

  it('falls back to a generic message for an unrecognised payload', () => {
    expect(ApiError.fromResponse(500, { weird: true })).toMatchObject({
      status: 500,
      message: 'Unexpected error occurred.',
    })
  })

  it('is an Error subclass named ApiError', () => {
    const error = ApiError.fromResponse(400, { message: 'x' })

    expect(error).toBeInstanceOf(Error)
    expect(error.name).toBe('ApiError')
  })
})
