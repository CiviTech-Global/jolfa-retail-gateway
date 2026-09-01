import { z } from "zod";

/**
 * Optional-field semantics for nullable columns, kept deliberately explicit
 * because the three states are not interchangeable on a PATCH:
 *
 *   key absent       → `undefined` → leave the column unchanged
 *   key sent as ""   → `null`      → clear the column
 *   key sent as null → `null`      → clear the column
 *
 * A plain `.optional()` rejects `null`, and `z.coerce.number()` silently turns
 * `null` into `0` — which then fails `.positive()` with a message the user
 * cannot act on. Both were live bugs reachable from the admin forms.
 */
function normalizeEmpty(value: unknown): unknown {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value === "string" && value.trim() === "") return null;
  return value;
}

/**
 * `z.preprocess` widens the inferred input to `unknown`; the explicit
 * `z.ZodType` result keeps the OUTPUT type intact so Prisma still typechecks
 * against the parsed value.
 */
type Nullish<T extends z.ZodTypeAny> = z.ZodType<z.infer<T> | null | undefined, z.ZodTypeDef, unknown>;

/** Optional, clearable field. */
export function nullable<T extends z.ZodTypeAny>(schema: T): Nullish<T> {
  return z.preprocess(normalizeEmpty, schema.nullish()) as unknown as Nullish<T>;
}

/** Optional, clearable number field — without `null → 0` coercion. */
export function nullableNumber<T extends z.ZodTypeAny>(schema: T): Nullish<T> {
  return z.preprocess((value) => {
    const normalized = normalizeEmpty(value);
    if (normalized === null || normalized === undefined) return normalized;
    if (typeof normalized === "string") {
      const parsed = Number(normalized);
      return Number.isNaN(parsed) ? normalized : parsed;
    }
    return normalized;
  }, schema.nullish()) as unknown as Nullish<T>;
}

/** Alias kept for readability at call sites dealing with text columns. */
export const nullableString = nullable;

/**
 * Optional but NOT clearable — for non-nullable columns such as `slug`, where
 * an empty value means "derive it" rather than "store null".
 */
export function optionalString<T extends z.ZodTypeAny>(
  schema: T,
): z.ZodType<z.infer<T> | undefined, z.ZodTypeDef, unknown> {
  return z.preprocess(
    (value) => (normalizeEmpty(value) === null ? undefined : value),
    schema.optional(),
  ) as unknown as z.ZodType<z.infer<T> | undefined, z.ZodTypeDef, unknown>;
}

/** Trimmed required string with a Persian message. */
export function requiredString(field: string, max: number) {
  return z
    .string({ required_error: `${field} الزامی است`, invalid_type_error: `${field} الزامی است` })
    .trim()
    .min(1, `${field} الزامی است`)
    .max(max, `${field} حداکثر ${max} کاراکتر است`);
}

/**
 * Accepts an absolute URL or a server-relative path (e.g. an upload result).
 * `min` runs before `refine` so the chain stays a ZodString for callers that
 * need to extend it.
 */
export function imageUrl(requiredMessage = "آدرس تصویر الزامی است") {
  return z
    .string({ required_error: requiredMessage })
    .trim()
    .min(1, requiredMessage)
    .max(500, "آدرس تصویر حداکثر ۵۰۰ کاراکتر است")
    .refine(
      (value) => value.startsWith("/") || /^https?:\/\//i.test(value),
      "آدرس تصویر باید یک نشانی معتبر یا مسیر داخلی باشد",
    );
}

export const uuidSchema = (field: string) =>
  z.string({ required_error: `${field} الزامی است` }).uuid(`${field} معتبر نیست`);
