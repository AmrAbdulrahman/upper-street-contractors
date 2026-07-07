'use client';

/**
 * <ZeroCmsList> — the reusable wrapper for a "list-like" section: a parent entry's
 * `references` (One-to-Many) relation rendered as a grid/row of cards. In inspect
 * mode it appends a "+ Add" button (<AddZeroCmsEntry>) and, when the field defines
 * a `max` in the schema, disables Add once the list is full. Outside inspect mode it
 * just renders the items in the given container, so it is inert (and layout-identical)
 * on public pages.
 *
 * Removal is NOT offered here — a child is removed from the parent's Edit drawer
 * (the references field editor), which is the single place removal lives.
 *
 * RSC note: the host sections are Server Components, so this takes **pre-rendered
 * `children`** (elements serialize across the server→client boundary) plus a
 * serializable `items` array (parallel to the children, used only for entry ids +
 * count). It does NOT take a render function — functions can't cross that boundary.
 *
 * Must live inside the parent's <ZeroCmsEntry> (it reads the parent id/type from
 * context, like <AddZeroCmsEntry>). Items normally self-wrap in their own
 * <ZeroCmsEntry>, so this does NOT re-wrap them — that would double the outline.
 */

import { Children, Fragment, useEffect, useState, type ReactNode } from 'react';
import { useZeroCmsOptional } from '@usc/zero-cms-app';
import { useZeroCmsWidgetOptional } from '../context';
import { useZeroCmsEntry, entryRefId, type ZeroCmsEntryRef } from './entry-context';
import { AddZeroCmsEntry } from './AddZeroCmsEntry';

export interface ZeroCmsListProps {
  /** Parent `references` field these items belong to (same value as <AddZeroCmsEntry>). */
  field: string;
  /**
   * The list items as serializable data (zero-cms/GraphQL entries carrying an id),
   * index-aligned with `children`. Used only for entry ids + the count — pass the
   * same array you mapped into `children` (nulls kept for alignment).
   */
  items: ReadonlyArray<unknown>;
  /** Pre-rendered item elements (the section's `items.map(...)`), index-aligned with `items`. */
  children: ReactNode;
  /** Container classes — the grid/flex the section uses to hold the items + add button. */
  className?: string;
  /** Container element. Use 'ul'/'ol' when items render as <li> (e.g. bullet lists). */
  as?: 'div' | 'ul' | 'ol';
}

// Parent type is not carried in public GraphQL fragments (they select only ids +
// values), so we resolve it once per entry via `locate` and cache it per session.
const typeCache = new Map<string, string>();

export function ZeroCmsList({ field, items, children, className, as = 'div' }: ZeroCmsListProps) {
  const widget = useZeroCmsWidgetOptional();
  const ctx = useZeroCmsEntry();
  const zeroCms = useZeroCmsOptional();

  const inspect = Boolean(widget?.inspect && ctx?.entryId);
  const entryId = ctx?.entryId;

  // Resolve the schema `max` for this field (inspect-only; editor UI, not public).
  const [max, setMax] = useState<number | undefined>(undefined);
  useEffect(() => {
    if (!inspect || !zeroCms || !entryId) {
      setMax(undefined);
      return;
    }
    let live = true;
    void (async () => {
      let pType = ctx?.typeName ?? typeCache.get(entryId) ?? null;
      if (!pType) {
        pType = (await zeroCms.adapter.locate(entryId))?.type ?? null;
        if (pType) typeCache.set(entryId, pType);
      }
      const def = zeroCms.schema
        .find((t) => t.__name === pType)
        ?.fields.find((f) => f.__name === field);
      if (live) setMax(def && def.__type === 'references' ? def.max : undefined);
    })();
    return () => {
      live = false;
    };
  }, [inspect, zeroCms, entryId, ctx?.typeName, field]);

  const childArray = Children.toArray(children);
  const count = items.filter((it) => it != null).length;
  const atMax = max != null && count >= max;

  // Public + empty: render nothing (no stray empty grid). In inspect, still render
  // the container so the "+ Add" button is available to seed the first item.
  if (!count && !inspect) return null;

  const Container = as;
  const add = (
    <AddZeroCmsEntry
      field={field}
      disabled={atMax}
      disabledReason={max != null ? `Maximum of ${max} reached` : undefined}
    />
  );

  return (
    <Container className={className}>
      {items.map((item, i) => {
        const node = childArray[i];
        if (item == null || node == null) return null;
        const key = entryRefId(item as ZeroCmsEntryRef) || String(i);
        // Items self-wrap in their own <ZeroCmsEntry>; render them bare (public + inspect).
        return <Fragment key={key}>{node}</Fragment>;
      })}
      {inspect && (as === 'div' ? add : <li className="list-none">{add}</li>)}
    </Container>
  );
}
