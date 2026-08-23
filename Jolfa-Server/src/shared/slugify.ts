import { randomBytes } from "node:crypto";

/**
 * URL slug from a title.
 *
 * Slugs stay latin-only: they appear in URLs and the admin form validates the
 * same shape, so allowing Persian here would produce values that form could no
 * longer save. A Persian title therefore yields nothing usable, which is the
 * normal case in this store — callers pair this with `uniqueSlug` to get a
 * readable fallback instead of an empty string.
 */
export function slugify(input: string, maxLength = 220): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, maxLength);
}

/** Short random suffix — enough to separate same-titled records. */
function randomSuffix(): string {
  return randomBytes(3).toString("hex");
}

interface UniqueSlugOptions {
  /** Falls back to `${prefix}-${random}` when the title has no latin characters. */
  prefix: string;
  /** True when the slug is already taken. */
  isTaken: (slug: string) => Promise<boolean>;
  maxLength?: number;
}

/**
 * Derives a slug that is free to use. A Persian-only title collapses to an
 * empty string, so every such record would otherwise claim the same slug and
 * every one after the first would fail with a duplicate-slug conflict.
 */
export async function uniqueSlug(
  title: string,
  { prefix, isTaken, maxLength = 220 }: UniqueSlugOptions,
): Promise<string> {
  const base = slugify(title, maxLength);

  if (!base) {
    // No latin characters to work with: generate one and confirm it is free.
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const candidate = `${prefix}-${randomSuffix()}`;
      if (!(await isTaken(candidate))) return candidate;
    }
    return `${prefix}-${Date.now().toString(36)}`;
  }

  if (!(await isTaken(base))) return base;

  // "my-product" taken → "my-product-2", "my-product-3", …
  for (let suffix = 2; suffix <= 20; suffix += 1) {
    const candidate = `${base.substring(0, maxLength - 4)}-${suffix}`;
    if (!(await isTaken(candidate))) return candidate;
  }

  return `${base.substring(0, maxLength - 8)}-${randomSuffix()}`;
}
