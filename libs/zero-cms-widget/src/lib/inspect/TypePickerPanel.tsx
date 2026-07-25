'use client';

/**
 * The "Add section" drawer — the step in FRONT of the create drawer.
 *
 * `openCreate` used to hardcode `allowedTypes[0]`, so a relation field that
 * accepted twenty section Types could only ever create the first one. This is
 * the choice that was missing: a grid of wireframe glyphs, one per allowed Type,
 * with the Type's label and description.
 *
 * Picking a Type either goes straight to a create form, or — when entries of
 * that Type already exist — offers reuse first, since a CTA or an FAQ block is
 * often the same content on several pages. Reused entries are shared, so each
 * candidate shows how many parents already hold it. That count comes from ONE
 * query of the parent's own Type (all `page`s, all `blog-post`s — small
 * collections), which is the only honest way to get it: `useEntryOptions` loads
 * the candidate children, not the parents that point at them.
 */

import { useEffect, useMemo, useState } from 'react';
import {
  useZeroCms,
  useEntryOptions,
  typeGlyph,
  ui,
  type TypePickResult,
} from '@usc/zero-cms-app';
import type { TypePickerContext } from '../context';

const NO_COUNTS: ReadonlyMap<string, number> = new Map();

/** How many parents of the same Type already reference each candidate id. */
function useUsageCounts(
  parentType: string | null | undefined,
  parentField: string | undefined
): ReadonlyMap<string, number> {
  const { adapter } = useZeroCms();
  const [counts, setCounts] = useState<ReadonlyMap<string, number>>(NO_COUNTS);

  useEffect(() => {
    if (!parentType || !parentField) return;
    let live = true;
    void (async () => {
      try {
        const { data } = await adapter.query(parentType, {
          status: 'draft',
          includeUnpublished: true,
        });
        const next = new Map<string, number>();
        for (const parent of data) {
          const raw = parent[parentField];
          const ids = Array.isArray(raw) ? raw : typeof raw === 'string' ? [raw] : [];
          for (const id of ids) {
            if (typeof id === 'string') next.set(id, (next.get(id) ?? 0) + 1);
          }
        }
        if (live) setCounts(next);
      } catch {
        // A failed count must never block adding a section — no badges is fine.
      }
    })();
    return () => {
      live = false;
    };
  }, [adapter, parentType, parentField]);

  return counts;
}

export function TypePickerPanel({
  pick,
  onPick,
}: {
  pick: TypePickerContext;
  onPick: (result: TypePickResult | null) => void;
}) {
  const { schema } = useZeroCms();
  const { allowedTypes, fieldLabel, parentType, parentField } = pick;
  const { options, loading } = useEntryOptions(allowedTypes);
  const counts = useUsageCounts(parentType, parentField);

  /** null = showing the Type grid; otherwise the Type whose reuse list is open. */
  const [reuseType, setReuseType] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const types = useMemo(
    () =>
      allowedTypes.map((name) => ({
        name,
        label: schema.find((t) => t.__name === name)?.label ?? name,
        description: schema.find((t) => t.__name === name)?.description,
        thumbnail: schema.find((t) => t.__name === name)?.thumbnail,
        existing: options.filter((o) => o.type === name),
      })),
    [allowedTypes, schema, options]
  );

  const parentLabel = parentType
    ? (schema.find((t) => t.__name === parentType)?.label ?? parentType).toLowerCase()
    : 'page';

  if (reuseType) {
    const t = types.find((x) => x.name === reuseType);
    const q = search.trim().toLowerCase();
    const shown = (t?.existing ?? []).filter((o) => !q || o.label.toLowerCase().includes(q));
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <ui.Button onClick={() => setReuseType(null)} aria-label="Back to section types">
            ← Back
          </ui.Button>
          <h3 className="text-base font-semibold text-neutral-900">{t?.label}</h3>
        </div>

        <ui.Button
          variant="primary"
          className="w-full"
          onClick={() => onPick({ kind: 'create', type: reuseType })}
        >
          ＋ Create new {t?.label}
        </ui.Button>

        <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-neutral-400">
          <span className="h-px flex-1 bg-neutral-200" />
          or reuse an existing one
          <span className="h-px flex-1 bg-neutral-200" />
        </div>

        <p className="text-xs text-neutral-500">
          A reused {t?.label?.toLowerCase()} is the same content in both places — editing it here
          changes every {parentLabel} that uses it.
        </p>

        <ui.Input
          placeholder="Search…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label={`Search ${t?.label ?? 'entries'}`}
        />

        <ul className="max-h-80 space-y-1 overflow-y-auto">
          {shown.map((o) => (
            <li key={o.id}>
              <button
                type="button"
                onClick={() => onPick({ kind: 'link', id: o.id, type: o.type })}
                className="flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-sm text-neutral-700 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
              >
                <span className="min-w-0 flex-1 truncate">{o.label}</span>
                <UsageBadge count={counts.get(o.id) ?? 0} parentLabel={parentLabel} />
              </button>
            </li>
          ))}
          {shown.length === 0 && (
            <li className="px-3 py-2 text-sm text-neutral-400">
              {loading ? 'Loading…' : q ? 'No matches.' : `No existing ${t?.label} to reuse.`}
            </li>
          )}
        </ul>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold text-neutral-900">
          Add {fieldLabel ? fieldLabel.toLowerCase().replace(/s$/, '') : 'section'}
        </h3>
        <p className="mt-1 text-sm text-neutral-600">Choose what kind of block to add.</p>
      </div>

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {types.map((t) => (
          <li key={t.name}>
            <button
              type="button"
              // Nothing to reuse ⇒ the reuse step would be an empty screen, so
              // go straight to the create form. While the option lists are
              // still loading we can't know that yet, and guessing "none" would
              // skip reuse for a Type that has plenty — so show the step and
              // let it resolve there.
              onClick={() =>
                t.existing.length || loading
                  ? setReuseType(t.name)
                  : onPick({ kind: 'create', type: t.name })
              }
              className="flex h-full w-full flex-col gap-2 rounded-lg border border-neutral-200 p-2 text-left transition-colors hover:border-neutral-900 hover:bg-neutral-50"
            >
              <span className="block h-16 w-full rounded-md border border-neutral-200 bg-neutral-50 p-2 text-neutral-400">
                {typeGlyph(t.thumbnail)}
              </span>
              <span className="block text-sm font-semibold text-neutral-900">{t.label}</span>
              {t.description ? (
                <span className="block text-xs leading-snug text-neutral-500">
                  {t.description}
                </span>
              ) : null}
            </button>
          </li>
        ))}
      </ul>

      <ui.Button onClick={() => onPick(null)}>Cancel</ui.Button>
    </div>
  );
}

function UsageBadge({ count, parentLabel }: { count: number; parentLabel: string }) {
  if (count <= 0)
    return <span className="shrink-0 text-xs text-neutral-400">unused</span>;
  return (
    <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
      in {count} {count === 1 ? parentLabel : `${parentLabel}s`}
    </span>
  );
}
