/**
 * Reference integrity (ADR 0006): an Entry can only be deleted when nothing
 * references it — and references inside another Entry's `__draft` count.
 */

import type { Entry } from '../model/entry';
import type { ReferenceHit } from '../model/errors';
import type { SchemaIndex } from './schema-index';

function idsInValue(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === 'string');
  return [];
}

/** All references to `targetId` across every entry's values and draft. */
export function findReferencesTo(
  targetId: string,
  entries: Entry[],
  schema: SchemaIndex
): ReferenceHit[] {
  const hits: ReferenceHit[] = [];
  for (const entry of entries) {
    if (entry.__id === targetId) continue;
    if (!schema.has(entry.__type)) continue;
    const refFields = schema.referenceFields(entry.__type);
    if (refFields.length === 0) continue;

    for (const slot of [
      { where: 'values' as const, bag: entry.values },
      { where: 'draft' as const, bag: entry.__draft },
    ]) {
      if (!slot.bag) continue;
      for (const f of refFields) {
        if (idsInValue(slot.bag[f.__name]).includes(targetId)) {
          hits.push({
            fromId: entry.__id,
            fromType: entry.__type,
            field: f.__name,
            in: slot.where,
          });
        }
      }
    }
  }
  return hits;
}

/**
 * Validate that every reference held by `entry` points at an existing entry of an
 * allowed type. Returns dangling/invalid hits (does not throw) — used by the
 * `validateRefs` helper surfaced as warnings, since publish is not blocked.
 */
export function findDanglingReferences(
  entry: Entry,
  byId: Map<string, Entry>,
  schema: SchemaIndex
): Array<{ field: string; id: string; reason: 'missing' | 'wrong-type' }> {
  const out: Array<{ field: string; id: string; reason: 'missing' | 'wrong-type' }> = [];
  if (!schema.has(entry.__type)) return out;
  const bag = entry.__draft ?? entry.values;
  if (!bag) return out;
  for (const f of schema.referenceFields(entry.__type)) {
    for (const id of idsInValue(bag[f.__name])) {
      const target = byId.get(id);
      if (!target) out.push({ field: f.__name, id, reason: 'missing' });
      else if (!f.allowedTypes.includes(target.__type))
        out.push({ field: f.__name, id, reason: 'wrong-type' });
    }
  }
  return out;
}
