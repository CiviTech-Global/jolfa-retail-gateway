import { ApiError } from './errors'

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

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
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

  const token = localStorage.getItem('token')
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
