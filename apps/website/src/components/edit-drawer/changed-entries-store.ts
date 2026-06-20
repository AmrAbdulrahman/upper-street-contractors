"use client";

import { useSyncExternalStore } from "react";

/** An entry that was edited (draft saved) during this browser session. */
export type ChangedEntry = {
  documentId: string;
  typename: string | null;
};

// Session-scoped, in-memory only. Survives router.refresh() (soft) but a hard
// reload clears it — the drafts still exist in Strapi, they're just no longer
// listed for one-click publish.
let entries: ChangedEntry[] = [];
const EMPTY: ChangedEntry[] = [];
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) {
    listener();
  }
}

function keyOf(entry: ChangedEntry): string {
  return `${entry.typename ?? ""}:${entry.documentId}`;
}

export function recordChangedEntry(entry: ChangedEntry): void {
  const key = keyOf(entry);
  if (entries.some((existing) => keyOf(existing) === key)) {
    return;
  }
  entries = [...entries, entry];
  emit();
}

export function removeChangedEntry(entry: ChangedEntry): void {
  const key = keyOf(entry);
  const next = entries.filter((existing) => keyOf(existing) !== key);
  if (next.length === entries.length) {
    return;
  }
  entries = next;
  emit();
}

export function clearChangedEntries(): void {
  if (entries.length === 0) {
    return;
  }
  entries = [];
  emit();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): ChangedEntry[] {
  return entries;
}

function getServerSnapshot(): ChangedEntry[] {
  return EMPTY;
}

export function useChangedEntries(): ChangedEntry[] {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
