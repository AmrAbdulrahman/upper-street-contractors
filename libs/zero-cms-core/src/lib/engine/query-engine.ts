/**
 * In-memory query evaluation: applies the serializable Where/Sort/Page DSL and
 * the read-status version rules (ADR 0006) to a list of entries.
 */

import type { Entry, ReadStatus } from '../model/entry';
import { hasDraft, materializeValues } from '../model/entry';
import type { FieldFilter, QueryInput, Where } from '../model/query';

/** A materialized row: the chosen-version values plus the derived/meta fields. */
export interface Row {
  entry: Entry;
  values: Record<string, unknown>;
}

/**
 * Which entries are visible at a given read status (this is the version-selector
 * inclusion rule, NOT the user's `where` filter):
 * - `published` → only entries with a live published version
 * - `draft` → entries with pending edits, plus published ones; excludes
 *   unpublished entries that have no draft (intentionally gone).
 */
export function visibleAt(entry: Entry, status: ReadStatus): boolean {
  if (status === 'published') return entry.__status === 'published';
  return hasDraft(entry) || entry.__status === 'published';
}

function toRow(entry: Entry, status: ReadStatus): Row {
  return { entry, values: materializeValues(entry, status) ?? {} };
}

/** Read a field for filtering/sorting, including the derived meta fields. */
function readField(row: Row, field: string): unknown {
  if (field === '__status') return row.entry.__status;
  if (field === 'hasDraft') return hasDraft(row.entry);
  if (field === '__id') return row.entry.__id;
  return row.values[field];
}

function matchFilter(value: unknown, f: FieldFilter): boolean {
  if (f.exists !== undefined) {
    const exists = value !== null && value !== undefined;
    if (exists !== f.exists) return false;
  }
  if (f.eq !== undefined && value !== f.eq) return false;
  if (f.ne !== undefined && value === f.ne) return false;
  if (f.in !== undefined && !f.in.includes(value)) return false;
  if (f.nin !== undefined && f.nin.includes(value)) return false;
  if (f.contains !== undefined) {
    if (typeof value !== 'string') return false;
    if (!value.toLowerCase().includes(f.contains.toLowerCase())) return false;
  }
  if (f.gt !== undefined && !(compare(value, f.gt) > 0)) return false;
  if (f.gte !== undefined && !(compare(value, f.gte) >= 0)) return false;
  if (f.lt !== undefined && !(compare(value, f.lt) < 0)) return false;
  if (f.lte !== undefined && !(compare(value, f.lte) <= 0)) return false;
  return true;
}

function compare(a: unknown, b: unknown): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  const as = String(a);
  const bs = String(b);
  return as < bs ? -1 : as > bs ? 1 : 0;
}

function matchWhere(row: Row, where: Where): boolean {
  for (const [field, filter] of Object.entries(where)) {
    if (!matchFilter(readField(row, field), filter)) return false;
  }
  return true;
}

export interface EvaluatedQuery {
  /** Page of rows (after where/sort/page). */
  rows: Row[];
  /** Total matching rows before paging. */
  total: number;
}

export function evaluateQuery(entries: Entry[], input: QueryInput): EvaluatedQuery {
  const status: ReadStatus = input.status ?? 'published';
  const includeAll = status === 'draft' && input.includeUnpublished === true;

  let rows = entries
    .filter((e) => includeAll || visibleAt(e, status))
    .map((e) => toRow(e, status));

  if (input.where) rows = rows.filter((r) => matchWhere(r, input.where as Where));

  if (input.sort?.length) {
    const sort = input.sort;
    rows = [...rows].sort((ra, rb) => {
      for (const s of sort) {
        const c = compare(readField(ra, s.field), readField(rb, s.field));
        if (c !== 0) return s.dir === 'desc' ? -c : c;
      }
      return 0;
    });
  }

  const total = rows.length;
  const offset = input.page?.offset ?? 0;
  const limit = input.page?.limit;
  rows = rows.slice(offset, limit === undefined ? undefined : offset + limit);

  return { rows, total };
}
