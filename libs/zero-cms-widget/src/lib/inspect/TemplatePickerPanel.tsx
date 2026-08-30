'use client';

/**
 * The "start from a template" drawer — the step in FRONT of a new Blog Post,
 * Service page or Project.
 *
 * A sibling of `TypePickerPanel`, but the choice it offers is the opposite one.
 * The Type picker asks *what kind of block* to add and then offers to **reuse**
 * an existing entry — the same content in two places. A template is never
 * reused: picking one deep-copies it, so the new entry is independent from the
 * first keystroke. That is the whole point, and it is why this cannot simply be
 * the Type picker pointed at a different Type.
 *
 * "Start blank" is a first-class option rather than a Cancel. Cancel abandons
 * the whole action; blank still creates the entry, which is what an editor who
 * wants no scaffolding actually means.
 *
 * Templates are read straight off the adapter rather than through
 * `useEntryOptions`, because the filter is on the template's own `kind` field
 * and the options cache carries only id/label/media. One query of a small
 * collection, the same trade `useUsageCounts` makes.
 */

import { useEffect, useMemo, useState } from 'react';
import { useZeroCms, useEntryLabeller, ui } from '@usc/zero-cms-app';
import type { OutputEntry } from '@usc/zero-cms-core';
import type { TemplatePickerContext, TemplatePickResult } from '../context';

interface TemplateRow {
  id: string;
  entry: OutputEntry;
  /** How many entries the template carries, as a rough "how much is in here". */
  size: number;
}

export function TemplatePickerPanel({
  pick,
  onPick,
}: {
  pick: TemplatePickerContext;
  onPick: (result: TemplatePickResult | null) => void;
}) {
  const { adapter, schema } = useZeroCms();
  const label = useEntryLabeller();
  const { templateType, kind, kindField = 'kind', fieldMap, targetLabel } = pick;

  const [rows, setRows] = useState<TemplateRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // The template's list fields, so a row can say how much it holds.
  const sourceFields = useMemo(() => Object.keys(fieldMap), [fieldMap]);

  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const { data } = await adapter.query(templateType, {
          status: 'draft',
          includeUnpublished: true,
        });
        const next: TemplateRow[] = data
          .filter((t) => t[kindField] === kind)
          .map((t) => ({
            id: t.__id,
            entry: t,
            size: sourceFields.reduce((total, f) => {
              const v = t[f];
              return total + (Array.isArray(v) ? v.length : v ? 1 : 0);
            }, 0),
          }));
        if (live) setRows(next);
      } catch (err) {
        if (live) setError((err as Error)?.message ?? 'Could not load templates');
      }
    })();
    return () => {
      live = false;
    };
  }, [adapter, templateType, kind, kindField, sourceFields]);

  // Names come from the shared Entry title resolver, so a template reads the
  // same here as it does in the Content admin — including a Title override.
  const named = useMemo(() => {
    const type = schema.find((t) => t.__name === templateType);
    return (rows ?? [])
      .map((r) => ({ ...r, name: label(type, r.entry) }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [rows, schema, templateType, label]);

  const targetName =
    targetLabel ??
    (schema.find((t) => t.__name === pick.targetType)?.label ?? pick.targetType).toLowerCase();

  const loading = rows === null && !error;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold text-neutral-900">New {targetName}</h3>
        <p className="mt-1 text-sm text-neutral-600">
          Start from a template, or from nothing. A template is copied, not shared — editing
          what you make here never changes the template.
        </p>
      </div>

      <ui.Button
        variant="primary"
        className="w-full"
        onClick={() => onPick({ choice: 'blank' })}
      >
        ＋ Start blank
      </ui.Button>

      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-neutral-400">
        <span className="h-px flex-1 bg-neutral-200" />
        or use a template
        <span className="h-px flex-1 bg-neutral-200" />
      </div>

      {error ? (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      ) : null}

      <ul className="max-h-80 space-y-1 overflow-y-auto">
        {named.map((t) => (
          <li key={t.id}>
            <button
              type="button"
              onClick={() => onPick({ choice: 'template', id: t.id })}
              className="flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-sm text-neutral-700 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
            >
              <span className="min-w-0 flex-1 truncate">{t.name}</span>
              <span className="shrink-0 text-xs text-neutral-400">
                {t.size} {t.size === 1 ? 'item' : 'items'}
              </span>
            </button>
          </li>
        ))}
        {!error && named.length === 0 ? (
          <li className="px-3 py-2 text-sm text-neutral-400">
            {loading
              ? 'Loading…'
              : `No ${kind} templates yet — save one from an existing ${label} to start a library.`}
          </li>
        ) : null}
      </ul>

      <ui.Button onClick={() => onPick(null)}>Cancel</ui.Button>
    </div>
  );
}
