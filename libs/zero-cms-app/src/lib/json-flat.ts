/** Helpers for editing a flat scalar `json` object as one input per key. */

export type JsonScalar = string | number | boolean | null;

/**
 * A non-null, non-array object whose every value is a scalar — the shape that
 * gets the structured key→value inputs (e.g. `site-meta-config.mapLocation` =
 * `{ lat, lon }`). Anything nested/array falls back to a raw-JSON textarea.
 */
export function isFlatScalarObject(
  value: unknown
): value is Record<string, JsonScalar> {
  if (value == null || typeof value !== 'object' || Array.isArray(value)) return false;
  return Object.values(value as Record<string, unknown>).every(
    (v) => v === null || ['string', 'number', 'boolean'].includes(typeof v)
  );
}
