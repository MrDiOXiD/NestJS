/**
 * class-transformer helper for multipart/form-data id lists.
 * Accepts: '[1,3]' | '1,3' | '5' | repeated fields (['1','3']) | '' (treated as "not sent").
 * Anything unparseable becomes NaN so @IsInt({ each: true }) reports a clear error.
 */
export const parseIdList = ({ value }: { value: unknown }): unknown => {
  if (Array.isArray(value)) return value.map(toNumberIfNumeric);
  if (typeof value !== 'string') return value;

  const raw = value.trim();
  if (raw === '') return undefined;

  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return raw.split(',').map((part) => Number(part.trim()));
  }
};

const toNumberIfNumeric = (item: unknown): unknown =>
  typeof item === 'string' && item.trim() !== '' ? Number(item) : item;