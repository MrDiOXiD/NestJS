/** SQL fragments + tuning knobs shared by the search service. `a` is the table alias. */

/** Trigram word-similarity threshold (0-1). Lower = more typo tolerant, more noise. */
export const WORD_SIMILARITY = '0.45';

/** Typo-tolerant (fuzzy) matching only kicks in when exact matching finds fewer than this many products. */
export const FUZZY_FALLBACK_BELOW = 5;

/** Facets are cached in-process for this long. */
export const FACET_CACHE_TTL_MS = 60_000;

/** True when the product has a discount that is running right now (honours start/end dates). */
export const discountActive = (a: string): string => `(
  ${a}."discount" > 0
  AND (${a}."discountStartDate" IS NULL OR ${a}."discountStartDate" <= NOW())
  AND (${a}."discountEndDate"   IS NULL OR ${a}."discountEndDate"   >= NOW())
)`;

/** Price after the currently-active discount. */
export const finalPrice = (a: string): string =>
  `(${a}."price" * (1 - CASE WHEN ${discountActive(a)} THEN ${a}."discount" ELSE 0 END / 100.0))`;
