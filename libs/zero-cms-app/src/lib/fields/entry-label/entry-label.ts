'use client';

/**
 * The app's seam over the core Entry title resolver.
 *
 * The derivation itself lives in `@usc/zero-cms-core` (`entryTitle`) so the
 * migration script and the engine specs can use it without React. What the app
 * adds is the media library: an `asset` Title field resolves through
 * `MediaItem.alternativeText`/`filename`, and the whole library already sits in
 * `useZeroCms().media`, so no call site should be fetching for a label.
 *
 * `entryLabel` / `titleField` keep their old names and old call signatures —
 * they are public API (`@usc/zero-cms-app`) and every existing consumer still
 * compiles. Prefer `useEntryLabeller()` in a component: it is the only form
 * that can name an entry titled by an image.
 */

import { useCallback } from 'react';
import type { OutputEntry, Type } from '@usc/zero-cms-core';
import { entryTitle, isUntitled, titleFieldOf } from '@usc/zero-cms-core';
import { useZeroCms } from '../../context';

/** The Field a Type's titles come from — its Title field, or the implicit first text field. */
export function titleField(type: Type | undefined): string | undefined {
  return titleFieldOf(type)?.__name;
}

/**
 * What the CMS calls this entry. Without `media`, a Type titled by an `asset`
 * field falls back to `Untitled <Type label>` — pass the library, or use
 * `useEntryLabeller`.
 */
export function entryLabel(
  type: Type | undefined,
  entry: OutputEntry,
  media?: Parameters<typeof entryTitle>[2],
): string {
  return entryTitle(type, entry, media);
}

/** Names entries with the media library already in context. Identity-stable. */
export function useEntryLabeller(): (
  type: Type | undefined,
  entry: OutputEntry,
) => string {
  const { media } = useZeroCms();
  return useCallback(
    (type: Type | undefined, entry: OutputEntry) =>
      entryTitle(type, entry, media),
    [media],
  );
}

/**
 * Whether an entry's title is the `Untitled …` fallback — the case where a
 * short id beside it is the only thing telling two blank siblings apart.
 */
export function useIsUntitled(): (
  type: Type | undefined,
  entry: OutputEntry,
) => boolean {
  const { media } = useZeroCms();
  return useCallback(
    (type: Type | undefined, entry: OutputEntry) =>
      isUntitled(type, entry, media),
    [media],
  );
}
