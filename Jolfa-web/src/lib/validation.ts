import { z } from 'zod'

/**
 * Shared field vocabulary for every form in the app. Rules here mirror the
 * server schemas so the client rejects what the server would reject — and
 * phrases it in Persian before a round-trip.
 */

/** Persian/Arabic-Indic digits → ASCII, so "۰۹۱۲…" validates like "0912…". */
export function toEnglishDigits(value: string): string {
  return value
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
}

const digits = (value: unknown) =>
  typeof value === 'string' ? toEnglishDigits(value).trim() : value

/** Iranian mobile: 09xxxxxxxxx, also accepting +98/0098 forms. */
export const iranMobileSchema = z.preprocess(
  (value) => {
    if (typeof value !== 'string') return value
    return toEnglishDigits(value)
      .trim()
      .replace(/[\s-]/g, '')
      .replace(/^(\+98|0098)/, '0')
      .replace(/^9(\d{9})$/, '09$1')
  },
  z
    .string({ required_error: 'شماره موبایل الزامی است' })
    .min(1, 'شماره موبایل الزامی است')
    .regex(/^09\d{9}$/, 'شماره موبایل باید با ۰۹ شروع شود و ۱۱ رقم باشد'),
)

export const passwordSchema = z
  .string({ required_error: 'رمز عبور الزامی است' })
  .min(6, 'رمز عبور باید حداقل ۶ کاراکتر باشد')
  .max(72, 'رمز عبور حداکثر ۷۲ کاراکتر است')

/** Login only checks presence — strength rules belong on registration. */
export const currentPasswordSchema = z
  .string({ required_error: 'رمز عبور الزامی است' })
  .min(1, 'رمز عبور الزامی است')

/** Optional email: empty string means "not provided". */
export const optionalEmailSchema = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
  z.string().trim().email('ایمیل معتبر نیست').max(255, 'ایمیل حداکثر ۲۵۵ کاراکتر است').optional(),
)

export const requiredEmailSchema = z
  .string({ required_error: 'ایمیل الزامی است' })
  .trim()
  .min(1, 'ایمیل الزامی است')
  .email('ایمیل معتبر نیست')

/** Iranian postal code: exactly 10 digits. Optional. */
export const optionalPostalCodeSchema = z.preprocess(
  (value) => {
    const normalized = digits(value)
    if (typeof normalized === 'string') {
      const stripped = normalized.replace(/[\s-]/g, '')
      return stripped === '' ? undefined : stripped
    }
    return normalized
  },
  z.string().regex(/^\d{10}$/, 'کد پستی باید دقیقاً ۱۰ رقم باشد').optional(),
)

export function requiredText(field: string, max = 200) {
  return z
    .string({ required_error: `${field} الزامی است` })
    .trim()
    .min(1, `${field} الزامی است`)
    .max(max, `${field} حداکثر ${max} کاراکتر است`)
}

export function optionalText(field: string, max = 200) {
  return z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
    z.string().trim().max(max, `${field} حداکثر ${max} کاراکتر است`).optional(),
  )
}

/**
 * Numeric text input. Accepts Persian digits and thousands separators; returns
 * a number. `required: false` lets the field be cleared.
 */
export function numericField(
  field: string,
  { required = true, min, max, integer = true }: {
    required?: boolean
    min?: number
    max?: number
    integer?: boolean
  } = {},
) {
  return z.preprocess(
    (value) => {
      if (value === null || value === undefined) return undefined
      if (typeof value === 'number') return value
      if (typeof value !== 'string') return value
      const cleaned = toEnglishDigits(value).replace(/[,٬\s]/g, '').trim()
      if (cleaned === '') return undefined
      const parsed = Number(cleaned)
      return Number.isNaN(parsed) ? cleaned : parsed
    },
    (() => {
      let schema = z.number({
        required_error: `${field} الزامی است`,
        invalid_type_error: `${field} باید عدد باشد`,
      })
      if (integer) schema = schema.int(`${field} باید عدد صحیح باشد`)
      if (min !== undefined) schema = schema.min(min, `${field} نمی‌تواند کمتر از ${min} باشد`)
      if (max !== undefined) schema = schema.max(max, `${field} نمی‌تواند بیشتر از ${max} باشد`)
      return required ? schema : schema.optional()
    })(),
  )
}

/** Slug: optional, lowercase latin/digits/hyphens — matches the server regex. */
export const optionalSlugSchema = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
  z
    .string()
    .trim()
    .max(220, 'اسلاگ حداکثر ۲۲۰ کاراکتر است')
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      'اسلاگ فقط می‌تواند شامل حروف انگلیسی کوچک، عدد و خط تیره باشد',
    )
    .optional(),
)

/** Absolute URL or server-relative path (an upload result is the latter). */
export const optionalImageUrlSchema = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
  z
    .string()
    .trim()
    .max(500, 'آدرس تصویر حداکثر ۵۰۰ کاراکتر است')
    .refine(
      (value) => value.startsWith('/') || /^https?:\/\//i.test(value),
      'آدرس تصویر باید یک نشانی معتبر یا مسیر داخلی باشد',
    )
    .optional(),
)

export const requiredImageUrlSchema = z
  .string({ required_error: 'تصویر الزامی است' })
  .trim()
  .min(1, 'تصویر الزامی است')
  .max(500, 'آدرس تصویر حداکثر ۵۰۰ کاراکتر است')
  .refine(
    (value) => value.startsWith('/') || /^https?:\/\//i.test(value),
    'آدرس تصویر باید یک نشانی معتبر یا مسیر داخلی باشد',
  )

export const optionalUuidSchema = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
  z.string().uuid('شناسه انتخاب‌شده معتبر نیست').optional(),
)

export function requiredUuid(field: string) {
  return z
    .string({ required_error: `${field} الزامی است` })
    .min(1, `${field} الزامی است`)
    .uuid(`${field} معتبر نیست`)
}

/**
 * Empty-string-to-null for nullable server columns: sending `undefined` on a
 * PATCH leaves the column unchanged, `null` clears it.
 */
export function clearable<T>(value: T | undefined | ''): T | null {
  return value === undefined || value === '' ? null : value
}
