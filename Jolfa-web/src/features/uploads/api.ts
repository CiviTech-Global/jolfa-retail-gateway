import { API_BASE_URL } from '@/api/client'
import { ApiError } from '@/api/errors'

export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const
export const ACCEPT_ATTRIBUTE = ACCEPTED_IMAGE_TYPES.join(',')
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024

export interface UploadedFile {
  url: string
  filename: string
  size: number
  mimetype: string
}

export interface UploadOptions {
  /** 0–100, fired as the bytes leave the browser. */
  onProgress?: (percent: number) => void
  signal?: AbortSignal
}

/** Rejects obvious problems before spending bandwidth on them. */
export function validateImageFile(file: File): string | undefined {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type as (typeof ACCEPTED_IMAGE_TYPES)[number])) {
    return 'فقط تصویر با فرمت JPG، PNG، WebP یا GIF مجاز است'
  }
  if (file.size === 0) {
    return 'فایل انتخاب‌شده خالی است'
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return `حجم فایل باید کمتر از ${Math.round(MAX_UPLOAD_BYTES / (1024 * 1024))} مگابایت باشد`
  }
  return undefined
}

/**
 * Uses XMLHttpRequest rather than `fetch`: `fetch` exposes no upload-progress
 * events, so a progress bar built on it can only ever fake its motion.
 */
export function uploadFile(file: File, options: UploadOptions = {}): Promise<UploadedFile> {
  const clientError = validateImageFile(file)
  if (clientError) {
    return Promise.reject(new ApiError(clientError, 400, 'INVALID_FILE'))
  }

  return new Promise<UploadedFile>((resolve, reject) => {
    const formData = new FormData()
    formData.append('file', file)

    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${API_BASE_URL}/uploads`)
    xhr.responseType = 'json'
    xhr.setRequestHeader('Accept', 'application/json')

    const token = localStorage.getItem('token')
    if (token) {
      xhr.setRequestHeader('Authorization', `Bearer ${token}`)
    }
    // Content-Type is deliberately not set: the browser adds the multipart
    // boundary, and overriding it breaks parsing server-side.

    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) {
        options.onProgress?.(Math.round((event.loaded / event.total) * 100))
      }
    })

    xhr.addEventListener('load', () => {
      const payload: unknown =
        xhr.response ?? safeParse(typeof xhr.responseText === 'string' ? xhr.responseText : '')

      if (xhr.status >= 200 && xhr.status < 300) {
        const data = (payload as { data?: UploadedFile } | null)?.data
        if (!data?.url) {
          reject(new ApiError('پاسخ سرور معتبر نبود.', xhr.status, 'INVALID_RESPONSE'))
          return
        }
        options.onProgress?.(100)
        resolve(data)
        return
      }

      reject(ApiError.fromResponse(xhr.status, payload))
    })

    xhr.addEventListener('error', () => {
      reject(new ApiError('ارتباط با سرور برقرار نشد. اتصال اینترنت خود را بررسی کنید.', 0, 'NETWORK_ERROR'))
    })

    xhr.addEventListener('timeout', () => {
      reject(new ApiError('زمان آپلود به پایان رسید. دوباره تلاش کنید.', 0, 'TIMEOUT'))
    })

    xhr.addEventListener('abort', () => {
      reject(new ApiError('آپلود لغو شد.', 0, 'ABORTED'))
    })

    if (options.signal) {
      if (options.signal.aborted) {
        xhr.abort()
        return
      }
      options.signal.addEventListener('abort', () => xhr.abort(), { once: true })
    }

    xhr.send(formData)
  })
}

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}
