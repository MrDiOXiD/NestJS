/**
 * Persian/Arabic-aware text normalisation.
 * MUST stay in sync with the SQL function fa_normalize() in the migration —
 * the DB normalises stored text, this normalises the user's query.
 */
const CHAR_MAP: Record<string, string> = {
  'ي': 'ی', 'ى': 'ی', 'ك': 'ک', 'ۀ': 'ه', 'ة': 'ه',
  'أ': 'ا', 'إ': 'ا', 'آ': 'ا',
  '\u200c': ' ', // ZWNJ (نیم‌فاصله) -> space
};
const DIGITS = '0123456789';
const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';
const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const DIACRITICS = /[\u064B-\u065F\u0670\u0640]/g; // harakat + tatweel

export function normalizeText(input?: string | null): string {
  if (!input) return '';
  let out = '';
  for (const ch of input) {
    const ai = AR_DIGITS.indexOf(ch);
    const fi = FA_DIGITS.indexOf(ch);
    out += ai >= 0 ? DIGITS[ai] : fi >= 0 ? DIGITS[fi] : CHAR_MAP[ch] ?? ch;
  }
  return out.replace(DIACRITICS, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

/** Escape LIKE/ILIKE wildcards so user input is matched literally. */
export function escapeLike(s: string): string {
  return s.replace(/[\\%_]/g, (m) => `\\${m}`);
}

/** Build a safe prefix tsquery: "led lamp" -> "led:* & lamp:*" */
export function buildTsQuery(normalized: string, maxTokens = 8): string {
  const tokens = normalized
    .split(' ')
    .map((t) => t.replace(/[^\p{L}\p{N}]/gu, ''))
    .filter(Boolean)
    .slice(0, maxTokens);
  return tokens.map((t) => `${t}:*`).join(' & ');
}
