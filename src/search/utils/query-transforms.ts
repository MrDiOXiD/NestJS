/**
 * class-transformer helpers for query-string params.
 *
 * NOTE: main.ts runs ValidationPipe with enableImplicitConversion: true. For a boolean
 * property that turns the string "false" into `true` (Boolean("false")) BEFORE any
 * @Transform runs, so boolean flags must read the raw value from `obj[key]`.
 */

/** 'a,b' | ['a','b'] | '' -> string[] | undefined */
export const parseStringList = ({ value }: { value: unknown }): unknown => {
  if (value === undefined || value === null || value === '') return undefined;
  if (!Array.isArray(value) && typeof value !== 'string') return value;
  const list = Array.isArray(value) ? value : value.split(',');
  return list.map((item) => String(item).trim()).filter(Boolean);
};

/** 'true' | '1' | 'false' | '0' | '' -> boolean | undefined (garbage is passed through so @IsBoolean reports it) */
export const parseBooleanFlag = ({ obj, key }: { obj: Record<string, unknown>; key: string }): unknown => {
  const raw = obj[key];
  if (raw === true || raw === 'true' || raw === '1' || raw === 1) return true;
  if (raw === false || raw === 'false' || raw === '0' || raw === 0) return false;
  return raw === '' ? undefined : raw;
};

/** Trim + drop empty strings. */
export const trimString = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

/**
 * attr filter. Primary form is a JSON string:  ?attr={"color":"white","power":["9W","12W"]}
 * (works with every Express query parser). An already-parsed object (?attr[color]=white with the
 * "extended" query parser) is accepted too. Invalid JSON is passed through so @IsObject reports it.
 */
export const parseAttrFilter = ({ value }: { value: unknown }): unknown => {
  if (value === undefined || value === '') return undefined;
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};
