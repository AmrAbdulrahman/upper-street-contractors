"use client";

import { useSyncExternalStore } from "react";
import {
  listChangedEntries,
  type ChangedEntry,
} from "@/lib/entry-editor/actions";

export type { ChangedEntry };

const EMPTY: ChangedEntry[] = [];
const listeners = new Set<() => void>();

let entries: ChangedEntry[] = [];
let loading = false;
let loaded = false;

function emit(): void {
  for (const listener of listeners) {
    listener();
  }
}

async function fetchEntries(): Promise<void> {
  if (loading) return;

  loading = true;
  try {
    entries = await listChangedEntries();
    loaded = true;
  } catch {
    entries = [];
  } finally {
    loading = false;
    emit();
  }
}

export function refreshChangedEntries(): void {
  loaded = false;
  void fetchEntries();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);

  if (!loaded && !loading) {
    void fetchEntries();
  }

  const onFocus = () => {
    void fetchEntries();
  };
  window.addEventListener("focus", onFocus);

  return () => {
    listeners.delete(listener);
    window.removeEventListener("focus", onFocus);
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
