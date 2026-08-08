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
    if (isApiErrorPayload(payload)) {
      return new ApiError(payload.message, status, payload.code, payload.errors)
    }
    if (typeof payload === 'string' && payload.length > 0) {
      return new ApiError(payload, status)
    }
    return new ApiError('Unexpected error occurred.', status)
  }
}

function isApiErrorPayload(value: unknown): value is ApiErrorPayload {
  return (
    typeof value === 'object' &&
    value !== null &&
    'message' in value &&
    typeof (value as Record<string, unknown>).message === 'string'
  )
}
