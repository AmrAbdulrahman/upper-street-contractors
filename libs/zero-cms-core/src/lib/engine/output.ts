/**
 * Output materialization + reference resolution (populate).
 *
 * Consumers receive a FLAT entry: meta fields (`__id`, `__type`, `__status`,
 * `hasDraft`) alongside the chosen-version field values. Reference fields hold
 * ids by default; `populate` paths replace them with nested OutputEntries.
 *
 * Entries are no longer all resident in memory (ADR 0009 — per-entry storage,
 * no single-writer full-load) — resolving a populate path means fetching the
 * referenced entry through the port, so this is a real N+1 fetch pattern now,
 * not O(1) map lookups. A cycle guard still prevents infinite recursion on
 * reference loops; batching/caching within one resolution is a possible future
 * optimization, not required for correctness at this content scale.
 */

import type { Entry, ReadStatus } from '../model/entry';
import { hasDraft, materializeValues } from '../model/entry';
import type { SchemaIndex } from './schema-index';
import { visibleAt } from './query-engine';

export interface OutputEntry {
  __id: string;
  __type: string;
  __status: Entry['__status'];
  hasDraft: boolean;
  __createdAt: string;
  /**
   * The optimistic-concurrency token (ADR 0009) — callers must hold onto this
   * and resend it as `expectedLastEditedAt` on their next mutation of this entry.
   */
  __lastEditedAt: string;
  __lastEditedBy: string;
  [field: string]: unknown;
}

export interface ResolveCtx {
  /** Fetch a single entry by id, or `null` if it doesn't exist. */
  fetchEntry: (id: string) => Promise<Entry | null>;
  schema: SchemaIndex;
}

/** Flat output for one entry at a given read status (no populate). */
export function buildOutput(entry: Entry, status: ReadStatus): OutputEntry {
  const values = materializeValues(entry, status) ?? {};
  return {
    ...values,
    __id: entry.__id,
    __type: entry.__type,
    __status: entry.__status,
    hasDraft: hasDraft(entry),
    __createdAt: entry.__createdAt,
    __lastEditedAt: entry.__lastEditedAt,
    __lastEditedBy: entry.__lastEditedBy,
  };
}

/** Group dotted populate paths by their first segment. */
function groupPaths(paths: string[]): Map<string, string[]> {
  const groups = new Map<string, string[]>();
  for (const path of paths) {
    const dot = path.indexOf('.');
    const head = dot === -1 ? path : path.slice(0, dot);
    const rest = dot === -1 ? undefined : path.slice(dot + 1);
    const arr = groups.get(head) ?? [];
    if (rest) arr.push(rest);
    groups.set(head, arr);
  }
  return groups;
}

export async function resolveOutput(
  entry: Entry,
  status: ReadStatus,
  populate: string[] | undefined,
  ctx: ResolveCtx,
  visited: ReadonlySet<string> = new Set()
): Promise<OutputEntry> {
  const out = buildOutput(entry, status);
  if (!populate?.length) return out;
  if (!ctx.schema.has(entry.__type)) return out;

  const refFields = new Map(
    ctx.schema.referenceFields(entry.__type).map((f) => [f.__name, f])
  );
  const branch = new Set(visited).add(entry.__id);

  for (const [head, rest] of groupPaths(populate)) {
    const field = refFields.get(head);
    if (!field) continue; // not a reference field — ignore
    const raw = out[head];

    const resolveOne = async (id: unknown): Promise<OutputEntry | null> => {
      if (typeof id !== 'string') return null;
      if (branch.has(id)) return null; // cycle guard
      const target = await ctx.fetchEntry(id);
      if (!target || !visibleAt(target, status)) return null;
      return resolveOutput(target, status, rest, ctx, branch);
    };

    if (field.__type === 'references') {
      const ids = Array.isArray(raw) ? raw : [];
      const resolved = await Promise.all(ids.map(resolveOne));
      out[head] = resolved.filter((x): x is OutputEntry => x !== null);
    } else {
      out[head] = await resolveOne(raw);
    }
  }
  return out;
}
