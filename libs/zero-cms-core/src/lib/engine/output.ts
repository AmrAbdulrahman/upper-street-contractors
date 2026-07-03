/**
 * Output materialization + reference resolution (populate).
 *
 * Consumers receive a FLAT entry: meta fields (`__id`, `__type`, `__status`,
 * `hasDraft`) alongside the chosen-version field values. Reference fields hold
 * ids by default; `populate` paths replace them with nested OutputEntries.
 *
 * The data is fully in memory, so resolution is O(1) map lookups (no N+1); a
 * cycle guard prevents infinite recursion on reference loops.
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
  [field: string]: unknown;
}

export interface ResolveCtx {
  byId: Map<string, Entry>;
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

export function resolveOutput(
  entry: Entry,
  status: ReadStatus,
  populate: string[] | undefined,
  ctx: ResolveCtx,
  visited: ReadonlySet<string> = new Set()
): OutputEntry {
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

    const resolveOne = (id: unknown): OutputEntry | null => {
      if (typeof id !== 'string') return null;
      if (branch.has(id)) return null; // cycle guard
      const target = ctx.byId.get(id);
      if (!target || !visibleAt(target, status)) return null;
      return resolveOutput(target, status, rest, ctx, branch);
    };

    if (field.__type === 'references') {
      const ids = Array.isArray(raw) ? raw : [];
      out[head] = ids.map(resolveOne).filter((x): x is OutputEntry => x !== null);
    } else {
      out[head] = resolveOne(raw);
    }
  }
  return out;
}
