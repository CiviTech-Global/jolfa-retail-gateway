export interface ApiErrorPayload {
  message: string
  code?: string
  errors?: Record<string, string[]>
}

export class ApiError extends Error {
  status: number
  code?: string
  fieldErrors?: Record<string, string[]>

  constructor(message: string, status: number, code?: string, fieldErrors?: Record<string, string[]>) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.fieldErrors = fieldErrors
  }

  static fromResponse(status: number, payload: unknown): ApiError {
    // The server wraps failures as `{ success: false, error: {...} }`, so the
    // real message/code live one level down. Checking only the top level made
    // every failed request surface the generic fallback below instead of the
    // server's (Persian) message. The flat shape is still accepted.
    const nested = unwrapErrorEnvelope(payload)
    if (nested) {
      return new ApiError(nested.message, status, nested.code, nested.errors)
    }
    if (isApiErrorPayload(payload)) {
      return new ApiError(payload.message, status, payload.code, payload.errors)
    }
    if (typeof payload === 'string' && payload.length > 0) {
      return new ApiError(payload, status)
    }
    return new ApiError('Unexpected error occurred.', status)
  }
}

function unwrapErrorEnvelope(value: unknown): ApiErrorPayload | null {
  if (typeof value !== 'object' || value === null || !('error' in value)) {
    return null
  }

  const inner = (value as { error: unknown }).error
  if (!isApiErrorPayload(inner)) {
    return null
  }

  return {
    message: inner.message,
    code: inner.code,
    // The server names the field-error map `details`; the client reads
    // `errors`. Accept either so validation messages reach the form.
    errors: inner.errors ?? asFieldErrors((inner as { details?: unknown }).details),
  }
}

function asFieldErrors(value: unknown): Record<string, string[]> | undefined {
  if (typeof value !== 'object' || value === null) return undefined

  const entries = Object.entries(value as Record<string, unknown>).filter(
    (entry): entry is [string, string[]] =>
      Array.isArray(entry[1]) && entry[1].every((item) => typeof item === 'string'),
  )

  return entries.length > 0 ? Object.fromEntries(entries) : undefined
}

function isApiErrorPayload(value: unknown): value is ApiErrorPayload {
  return (
    typeof value === 'object' &&
    value !== null &&
    'message' in value &&
    typeof (value as Record<string, unknown>).message === 'string'
  )
}
