"use client";

import { useSyncExternalStore } from "react";
import {
  listChangedEntries,
  type ChangedEntry,
} from "@/lib/entry-editor/actions";

export type { ChangedEntry };

export type ChangedEntriesState = {
  entries: ChangedEntry[];
  loading: boolean;
  /** True once the first fetch has settled (success or failure). */
  loaded: boolean;
};

const EMPTY: ChangedEntry[] = [];
const SERVER_STATE: ChangedEntriesState = {
  entries: EMPTY,
  loading: false,
  loaded: false,
};

const listeners = new Set<() => void>();

// Single cached snapshot object — reassigned (new ref) only on real transitions
// so useSyncExternalStore sees a stable reference between emits.
let state: ChangedEntriesState = {
  entries: EMPTY,
  loading: false,
  loaded: false,
};

// Set when refreshChangedEntries() is called while a fetch is in-flight.
// The in-flight fetch replays once it settles so the caller's mutation is reflected.
let pendingRefresh = false;

function setState(next: Partial<ChangedEntriesState>): void {
  state = { ...state, ...next };
  for (const listener of listeners) {
    listener();
  }
}

async function fetchEntries(): Promise<void> {
  if (state.loading) {
    pendingRefresh = true;
    return;
  }

  pendingRefresh = false;
  setState({ loading: true });
  try {
    setState({ entries: await listChangedEntries(), loaded: true, loading: false });
  } catch {
    setState({ entries: EMPTY, loaded: true, loading: false });
  }

  if (pendingRefresh) {
    void fetchEntries();
  }
}

// Refetch in the background. `loaded` stays true so the button keeps showing the
// current count instead of flashing back to "Checking…" after a save/toggle.
export function refreshChangedEntries(): void {
  void fetchEntries();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);

  if (!state.loaded && !state.loading) {
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

function getSnapshot(): ChangedEntriesState {
  return state;
}

function getServerSnapshot(): ChangedEntriesState {
  return SERVER_STATE;
}

export function useChangedEntriesState(): ChangedEntriesState {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function useChangedEntries(): ChangedEntry[] {
  return useChangedEntriesState().entries;
}
