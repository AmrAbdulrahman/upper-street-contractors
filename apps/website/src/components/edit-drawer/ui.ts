// Shared presentation helpers for the edit drawer (plain module — safe to import
// from client leaves; no "use client" needed).

export type FormValues = Record<string, unknown>;

export const FIELD_INPUT_CLASS =
  "w-full rounded-md border border-border bg-white px-3 py-2 text-sm text-foreground placeholder:text-subtle outline-none transition-colors focus:border-gold focus:ring-2 focus:ring-gold/30 disabled:opacity-60";

export const FIELD_LABEL_CLASS =
  "mb-1.5 flex items-center gap-2 text-sm font-medium text-foreground";

export const FIELD_TYPE_BADGE_CLASS =
  "rounded bg-surface px-1.5 py-0.5 text-[11px] font-normal uppercase tracking-wide text-subtle";

export function humanizeFieldName(name: string): string {
  return name
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/^\w/, (char) => char.toUpperCase());
}

// --- JSON field helpers (shared by edit-form + json-field) ---

export type JsonScalar = string | number | boolean | null;

/** A non-null, non-array object whose every value is a scalar (the structured
 * key→value form path). Anything else falls back to the raw-JSON textarea. */
export function isFlatScalarObject(
  value: unknown,
): value is Record<string, JsonScalar> {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  return Object.values(value as Record<string, unknown>).every(
    (entry) =>
      entry === null || ["string", "number", "boolean"].includes(typeof entry),
  );
}

/** Null and flat scalar objects use the structured key→value inputs; anything
 * nested/array uses the textarea fallback. */
export function jsonIsFlat(original: unknown): boolean {
  return original == null || isFlatScalarObject(original);
}

/** Keys to render for a flat-object value, seeding from `fallbackKeys` (e.g.
 * lat/lon for an empty mapLocation) when the value itself has none. */
export function flatJsonKeys(
  original: unknown,
  fallbackKeys: string[] = [],
): string[] {
  if (isFlatScalarObject(original) && Object.keys(original).length > 0) {
    return Object.keys(original);
  }
  return fallbackKeys;
}

/**
 * Rebuild a typed object from the form's edit values (numbers/text held as
 * strings, booleans as booleans), using the original value as the type oracle.
 * Empty string → null. Returns NaN for number keys with non-numeric input so
 * the caller can flag them invalid.
 */
export function reconstructFlatJson(
  current: Record<string, unknown> | null | undefined,
  original: unknown,
  fallbackKeys: string[] = [],
): Record<string, JsonScalar> {
  const orig = isFlatScalarObject(original) ? original : {};
  const keys = flatJsonKeys(original, fallbackKeys);
  const out: Record<string, JsonScalar> = {};
  for (const key of keys) {
    const raw = current?.[key];
    const origValue = orig[key];
    if (typeof origValue === "boolean") {
      out[key] = Boolean(raw);
      continue;
    }
    if (raw === "" || raw == null) {
      out[key] = null;
      continue;
    }
    if (typeof origValue === "number") {
      out[key] = Number(raw);
      continue;
    }
    if (origValue == null) {
      // Seeded key (no original type): coerce numeric-looking input to number.
      const asString = String(raw);
      out[key] = /^-?\d*\.?\d+$/.test(asString) ? Number(asString) : asString;
      continue;
    }
    out[key] = String(raw);
  }
  return out;
}
