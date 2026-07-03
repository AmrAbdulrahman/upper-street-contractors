/**
 * Entry model — the shape stored in `data.json`.
 *
 * See ADR 0006: status uses two orthogonal axes.
 * - `__status` is the stored lifecycle (`published | unpublished`).
 * - `__draft` is the pending-edits overlay (`null` or a full values snapshot).
 *   Its presence is the derived `draft` / `hasDraft` state.
 */

/** Stored lifecycle of an Entry. */
export type EntryStatus = 'published' | 'unpublished';

export type EntryValues = Record<string, unknown>;

export interface Entry {
  /** Auto-generated uuid, unique across all entries. */
  __id: string;
  /** The owning Type's `__name`. */
  __type: string;
  /** Stored lifecycle. New entries start `unpublished`. */
  __status: EntryStatus;
  /** Live (published) values. Only change on `publish`. `null` until first publish. */
  values: EntryValues | null;
  /** Pending edits, full snapshot. `null` when there are no pending edits. */
  __draft: EntryValues | null;
}

/** Read-time version selector (NOT a filter). See ADR 0006. */
export type ReadStatus = 'published' | 'draft';

export function hasDraft(entry: Entry): boolean {
  return entry.__draft !== null;
}

/**
 * Materialize the requested version's values for an entry.
 * - `published` → live `values` (or `null` if not currently published)
 * - `draft` → `__draft` if present, else live `values`
 */
export function materializeValues(
  entry: Entry,
  status: ReadStatus
): EntryValues | null {
  if (status === 'published') {
    return entry.__status === 'published' ? entry.values : null;
  }
  // draft (preview)
  return entry.__draft ?? entry.values;
}
