/**
 * Query normalisation for Persian search.
 *
 * Persian text on the web is not typed consistently, and a naive `contains`
 * silently returns nothing for input a human would call identical:
 *
 *   ی (U+06CC Farsi yeh) vs ي (U+064A Arabic yeh)
 *   ک (U+06A9 Farsi keheh) vs ك (U+0643 Arabic kaf)
 *   ۰۱۲۳ (Persian digits) vs ٠١٢٣ (Arabic-Indic) vs 0123
 *   zero-width non-joiner inside compound words (می‌خواهم)
 *
 * The same word can be stored one way and typed the other — Android and iOS
 * keyboards differ, and pasted text carries whatever its source used. An admin
 * searching "کيف" for a product saved as "کیف" would be told nothing exists.
 *
 * Postgres could solve this with a normalising expression index, but that means
 * a migration per searchable column and rebuilding them whenever the rules
 * change. Expanding the *query* into its variants instead costs one OR per
 * variant, needs no schema, and is correct in both directions: the stored form
 * can be either and still be found.
 */

/** Characters that differ only by keyboard, mapped to one canonical form. */
const CANONICAL: Record<string, string> = {
  "ي": "ی", // Arabic yeh   -> Farsi yeh
  "ى": "ی", // alef maksura -> Farsi yeh
  "ك": "ک", // Arabic kaf   -> Farsi keheh
  "ة": "ه", // teh marbuta  -> heh
  "أ": "ا", // alef variants-> plain alef
  "إ": "ا",
  "آ": "ا",
};

/** Digits, in every script an Iranian keyboard produces. */
function asciiDigits(value: string): string {
  return value
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660));
}

/**
 * One canonical spelling: ASCII digits, canonical letterforms, no zero-width
 * joiners, collapsed whitespace.
 */
export function normalizeSearchTerm(value: string): string {
  const withAsciiDigits = asciiDigits(value);
  const canonical = [...withAsciiDigits]
    .map((char) => CANONICAL[char] ?? char)
    .join("")
    // ZWNJ and friends are invisible; whether one was typed is pure chance.
    // Built from a string rather than written as a regex literal because the
    // characters themselves are invisible in an editor: as literals they are
    // indistinguishable from a typo that would strip real digits and letters
    // out of every search, and `no-irregular-whitespace` rejects them outright.
    .replace(new RegExp("[\u200b-\u200f\u2060\ufeff]", "g"), "");

  return canonical.replace(/\s+/g, " ").trim();
}

/**
 * The spellings a stored value might plausibly use for this query.
 *
 * Returns the canonical form first, then the Arabic-keyboard spelling when it
 * differs, so a row saved either way is matched. Capped deliberately: every
 * variant is another OR branch, and beyond these two the combinations grow
 * faster than the recall improves.
 */
export function searchVariants(value: string): string[] {
  const canonical = normalizeSearchTerm(value);
  if (!canonical) return [];

  const arabicSpelling = canonical.replace(/ی/g, "ي").replace(/ک/g, "ك");

  return arabicSpelling === canonical ? [canonical] : [canonical, arabicSpelling];
}

/**
 * Builds Prisma `contains` filters for one field across every spelling.
 *
 * Returns `[]` for an empty query so callers can spread it into an OR array
 * without having to special-case "no search term".
 */
export function containsAnyVariant<TField extends string>(
  field: TField,
  query: string,
): { [K in TField]: { contains: string; mode: "insensitive" } }[] {
  return searchVariants(query).map(
    (variant) =>
      ({ [field]: { contains: variant, mode: "insensitive" } }) as {
        [K in TField]: { contains: string; mode: "insensitive" };
      },
  );
}

/** True when the query is all digits — a phone, an order number, an amount. */
export function isNumericQuery(value: string): boolean {
  const normalized = normalizeSearchTerm(value).replace(/[\s-]/g, "");
  return normalized.length > 0 && /^\d+$/.test(normalized);
}
