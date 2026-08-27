import { ApiError } from './errors'
import { clearTokens, getAccessToken, getRefreshToken, setTokens } from './tokens'

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3001/api/v1'

export interface ApiSuccessResponse<T> {
  success: true
  data: T
}

export type RequestOptions = Omit<RequestInit, 'body'> & {
  body?: unknown
}

/**
 * Bodies the browser must serialize itself. `JSON.stringify` on any of these
 * produces `"{}"` and, together with a forced JSON content-type, made every
 * file upload arrive at the server as an empty JSON document.
 */
function isRawBody(body: unknown): body is BodyInit {
  return (
    body instanceof FormData ||
    body instanceof Blob ||
    body instanceof ArrayBuffer ||
    body instanceof URLSearchParams ||
    ArrayBuffer.isView(body) ||
    body instanceof ReadableStream
  )
}

/**
 * In-flight refresh, shared by every caller.
 *
 * A page typically fires several queries at once. When the access token has
 * expired they all get a 401 within milliseconds of each other, and without
 * this they would each post their own refresh — rotating the token repeatedly
 * and leaving all but one holding a token that has already been superseded.
 */
let refreshInFlight: Promise<boolean> | null = null

/** Endpoints that must never trigger a refresh, or it would recurse. */
function isAuthEndpoint(path: string): boolean {
  return (
    path.startsWith('/auth/refresh') ||
    path.startsWith('/auth/login') ||
    path.startsWith('/auth/register')
  )
}

async function refreshAccessToken(): Promise<boolean> {
  const refreshToken = getRefreshToken()
  if (!refreshToken) return false

  try {
    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ refreshToken }),
    })

    if (!response.ok) {
      // The session was revoked or expired for good; stop pretending otherwise.
      clearTokens()
      return false
    }

    const json = (await response.json()) as ApiSuccessResponse<{
      tokens: { accessToken: string; refreshToken: string }
    }>
    setTokens(json.data.tokens)
    return true
  } catch {
    // A network blip is not proof the session is invalid, so the tokens stay.
    return false
  }
}

function refreshOnce(): Promise<boolean> {
  refreshInFlight ??= refreshAccessToken().finally(() => {
    refreshInFlight = null
  })
  return refreshInFlight
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  return sendRequest<T>(path, options, true)
}

async function sendRequest<T>(
  path: string,
  options: RequestOptions,
  allowRefresh: boolean,
): Promise<T> {
  const url = `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`
  const raw = isRawBody(options.body)

  const headers = new Headers(options.headers)
  // Let the browser set multipart/form-data itself: it has to append the
  // boundary token, which we cannot know here.
  if (!raw && !headers.has('Content-Type') && options.body !== undefined) {
    headers.set('Content-Type', 'application/json')
  }
  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json')
  }

  const token = getAccessToken()
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  let response: Response
  try {
    response = await fetch(url, {
      ...options,
      headers,
      body: raw
        ? (options.body as BodyInit)
        : options.body !== undefined
          ? JSON.stringify(options.body)
          : undefined,
    })
  } catch {
    // Network-level failure: no response, no status.
    throw new ApiError('ارتباط با سرور برقرار نشد. اتصال اینترنت خود را بررسی کنید.', 0, 'NETWORK_ERROR')
  }

  // An expired access token is recoverable without the user noticing: refresh
  // once, then replay the original request. Only once — a second 401 after a
  // successful refresh means the request is genuinely unauthorised.
  if (
    response.status === 401 &&
    allowRefresh &&
    !isAuthEndpoint(path) &&
    getRefreshToken() !== null &&
    // A stream body has already been consumed and cannot be replayed.
    !(options.body instanceof ReadableStream)
  ) {
    if (await refreshOnce()) {
      return sendRequest<T>(path, options, false)
    }
  }

  if (!response.ok) {
    let payload: unknown
    try {
      payload = await response.json()
    } catch {
      payload = undefined
    }
    throw ApiError.fromResponse(response.status, payload)
  }

  if (response.status === 204) {
    return undefined as T
  }

  const json = (await response.json()) as ApiSuccessResponse<T>
  return json.data
}
