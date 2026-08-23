export interface ApiErrorEnvelope {
  success: false
  error: {
    code?: string
    message: string
    details?: { fieldErrors?: Record<string, string[]> } & Record<string, unknown>
  }
}

/** Field-level messages, keyed by form field name. */
export type FieldErrors = Record<string, string[]>

export class ApiError extends Error {
  status: number
  code?: string
  fieldErrors?: FieldErrors

  constructor(message: string, status: number, code?: string, fieldErrors?: FieldErrors) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.fieldErrors = fieldErrors
  }

  /** True when the user can fix this by editing the form. */
  get isValidationError(): boolean {
    return this.status === 400 || this.status === 422
  }

  static fromResponse(status: number, payload: unknown): ApiError {
    const envelope = readEnvelope(payload)
    if (envelope) {
      return new ApiError(
        envelope.message,
        status,
        envelope.code,
        readFieldErrors(envelope.details),
      )
    }

    // Legacy/flat shape, kept as a fallback.
    if (isRecord(payload) && typeof payload.message === 'string') {
      return new ApiError(
        payload.message,
        status,
        typeof payload.code === 'string' ? payload.code : undefined,
        readFieldErrors(payload),
      )
    }

    if (typeof payload === 'string' && payload.length > 0) {
      return new ApiError(payload, status)
    }

    return new ApiError(fallbackMessage(status), status)
  }
}

/**
 * The server replies `{ success: false, error: { ... } }`. Reading `payload.message`
 * directly never matched, so every server-side failure surfaced as a generic
 * "unexpected error" and validation messages were lost.
 */
function readEnvelope(payload: unknown): ApiErrorEnvelope['error'] | undefined {
  if (!isRecord(payload)) return undefined
  const error = payload.error
  if (!isRecord(error) || typeof error.message !== 'string') return undefined
  return error as ApiErrorEnvelope['error']
}

function readFieldErrors(source: unknown): FieldErrors | undefined {
  if (!isRecord(source)) return undefined
  // `validateRequest` sends `{ details: { <field>: [msg] } }`; some routes nest
  // it under `fieldErrors`.
  const raw = isRecord(source.fieldErrors) ? source.fieldErrors : source
  const result: FieldErrors = {}
  for (const [key, value] of Object.entries(raw)) {
    if (key === 'issues') continue
    if (Array.isArray(value) && value.every((item) => typeof item === 'string')) {
      result[key] = value
    } else if (typeof value === 'string') {
      result[key] = [value]
    }
  }
  return Object.keys(result).length > 0 ? result : undefined
}

function fallbackMessage(status: number): string {
  if (status === 0) return 'ارتباط با سرور برقرار نشد. اتصال اینترنت خود را بررسی کنید.'
  if (status === 401) return 'برای انجام این کار باید وارد شوید.'
  if (status === 403) return 'شما اجازه انجام این کار را ندارید.'
  if (status === 404) return 'موردی یافت نشد.'
  if (status === 413) return 'حجم فایل بیش از حد مجاز است.'
  if (status >= 500) return 'خطای سرور. لطفاً دوباره تلاش کنید.'
  return 'خطای غیرمنتظره‌ای رخ داد.'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
