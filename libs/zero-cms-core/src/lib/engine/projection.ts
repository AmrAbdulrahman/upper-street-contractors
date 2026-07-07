/**
 * Read-time schema projection (ADR 0011).
 *
 * Redis has no schema of its own — adding/removing a field on a Type does not
 * touch any existing entry's stored blob. This applies the *current* schema
 * over whatever's actually stored, at read time, so callers never see drift:
 * a field the Type defines but the stored bag lacks gets its declared default
 * (or `null`); a stored key the Type no longer defines gets dropped. Never
 * writes anything — purely a view. Applied before `Where` filtering (see
 * `Engine.query`), so filtering against a newly-added field's default works.
 */

import type { EntryValues } from '../model/entry';
import type { Type } from '../model/schema';

export function applySchemaDefaults(type: Type, bag: EntryValues): EntryValues {
  const out: EntryValues = {};
  for (const field of type.fields) {
    out[field.__name] = field.__name in bag ? bag[field.__name] : (field.default ?? null);
  }
  // Any key in `bag` not in the current field list is a removed field — dropped
  // by construction, since `out` is built from `type.fields` alone.
  return out;
}
