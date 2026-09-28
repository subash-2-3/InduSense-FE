import { TagDefinition, TagMetadata, TagType, TagTypeOption } from '../../core/models';

/**
 * Tag form rules mirroring the backend (InduSense-BE `app/services/tag.py`); the server checks
 * them again. `data_type` is the value/register format (float32, int16, ...): round-off above 0
 * is refused for integer, boolean and string types; an empty data type (the connection's
 * default) or a float type allows it.
 */
export const NON_FLOAT_DATA_TYPES: ReadonlySet<string> = new Set([
  'int16',
  'uint16',
  'int32',
  'uint32',
  'int64',
  'uint64',
  'int',
  'integer',
  'bool',
  'boolean',
  'string',
  'text',
]);

/** Register formats offered in the form (free text is allowed too). */
export const DATA_TYPE_SUGGESTIONS = ['float32', 'int16', 'uint16', 'int32', 'uint32'] as const;

/** Lowercase logical key, e.g. `voltage`, `good_count` (same pattern as the backend). */
export const TAG_CODE_PATTERN = /^[a-z0-9][a-z0-9_.-]*$/;

export function isNonFloat(dataType: string | null | undefined): boolean {
  return NON_FLOAT_DATA_TYPES.has((dataType ?? '').trim().toLowerCase());
}

/**
 * Error for a round-off value typed into the form (`''` = not set), or null when valid.
 */
export function roundoffError(
  raw: string | number | null | undefined,
  dataType: string | null | undefined,
  max: number,
): string | null {
  if (raw === null || raw === undefined || String(raw).trim() === '') {
    return null;
  }
  const text = String(raw).trim();
  if (!/^\d+$/.test(text)) {
    return `Use a whole number from 0 to ${max}.`;
  }
  const digits = Number(text);
  if (digits > max) {
    return `At most ${max} decimals.`;
  }
  if (digits > 0 && isNonFloat(dataType)) {
    return `Round-off applies to floating-point tags only (data type ${dataType}): leave empty or use 0.`;
  }
  return null;
}

/** The form's round-off text as the API value (`''` = null). Call only when roundoffError is null. */
export function roundoffValue(raw: string | number | null | undefined): number | null {
  return raw === null || raw === undefined || String(raw).trim() === '' ? null : Number(raw);
}

export function tagTypeLabel(
  options: readonly TagTypeOption[],
  value: TagType | null | undefined,
): string {
  if (!value) {
    return '—';
  }
  const label = options.find((o) => o.value === value)?.label;
  return label ? label.split(' ')[0] : value.toUpperCase();
}

export function definitionsOf(metadata: TagMetadata | null, type: TagType | null): TagDefinition[] {
  return (metadata?.definitions ?? []).filter((d) => !type || d.tag_type === type);
}

/**
 * A value as the tag should be displayed: rounded to `digits` decimals when configured,
 * otherwise unchanged. Only presentation; stored telemetry is never rounded.
 */
export function formatWithRoundoff(
  value: number | null | undefined,
  digits: number | null | undefined,
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return '—';
  }
  if (digits === null || digits === undefined) {
    return String(value);
  }
  return value.toFixed(digits);
}

/** `{"0": "RUNNING", "1": "IDLE"}` -> `0=RUNNING, 1=IDLE` (the form's text for a state map). */
export function formatStateMap(map: Record<string, string> | null | undefined): string {
  if (!map) {
    return '';
  }
  return Object.entries(map)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([value, state]) => `${value}=${state}`)
    .join(', ');
}

/**
 * Parses `0=RUNNING, 1=IDLE, 2=ALARM` (the backend validates again). Empty text = no map
 * (non-zero = running).
 */
export function parseStateMap(
  text: string,
  states: readonly string[],
): { map: Record<string, string> | null; error: string | null } {
  const trimmed = text.trim();
  if (!trimmed) {
    return { map: null, error: null };
  }
  const map: Record<string, string> = {};
  for (const part of trimmed
    .split(/[,;\n]/)
    .map((p) => p.trim())
    .filter(Boolean)) {
    const match = /^(-?\d+)\s*[=:]\s*([A-Za-z_]+)$/.exec(part);
    if (!match) {
      return { map: null, error: `"${part}" is not value=STATE (e.g. 0=RUNNING).` };
    }
    const state = match[2].toUpperCase();
    if (!states.includes(state)) {
      return { map: null, error: `"${match[2]}" is not one of ${states.join(', ')}.` };
    }
    const key = String(Number(match[1]));
    if (key in map) {
      return { map: null, error: `Value ${key} is listed twice.` };
    }
    map[key] = state;
  }
  return { map, error: null };
}

/** `0, 1` -> [0, 1] (sorted, unique); empty = the server's default for the write mode. */
export function parseWriteValues(text: string): { values: number[] | null; error: string | null } {
  const parts = text
    .split(/[,;\s]+/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (!parts.length) {
    return { values: null, error: null };
  }
  const values: number[] = [];
  for (const part of parts) {
    if (!/^\d+$/.test(part) || Number(part) > 65535) {
      return { values: null, error: `"${part}" is not a whole number from 0 to 65535.` };
    }
    values.push(Number(part));
  }
  if (values.length > 16) {
    return { values: null, error: 'At most 16 values.' };
  }
  return { values: [...new Set(values)].sort((a, b) => a - b), error: null };
}
