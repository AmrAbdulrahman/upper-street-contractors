"use client";

import { useSyncExternalStore } from "react";
import type { CmsCall } from "@/lib/dev/cms-call-collector";

export type { CmsCall };

export type CmsCallState = {
  /** All calls polled since this client mounted (capped, oldest dropped). */
  entries: CmsCall[];
  /** Server lifetime total since `next dev` booted. */
  total: number;
  /** Server boot timestamp — a change means the dev server restarted. */
  bootTs: number | null;
  /** Poll cursor: highest call id seen. */
  lastId: number;
  /** Clear sets this to lastId; entries with id <= it are hidden from the view. */
  resetCursor: number;
};

// Keep client memory bounded over a long dev session.
const CLIENT_CAP = 5000;
const POLL_MS = 1000;

const EMPTY: CmsCall[] = [];
const SERVER_STATE: CmsCallState = {
  entries: EMPTY,
  total: 0,
  bootTs: null,
  lastId: 0,
  resetCursor: 0,
};

const listeners = new Set<() => void>();

// Reassigned (new ref) only on real transitions so useSyncExternalStore sees a
// stable reference between emits.
let state: CmsCallState = {
  entries: EMPTY,
  total: 0,
  bootTs: null,
  lastId: 0,
  resetCursor: 0,
};

let timer: ReturnType<typeof setInterval> | null = null;
let polling = false;

function emit(next: Partial<CmsCallState>): void {
  state = { ...state, ...next };
  for (const listener of listeners) listener();
}

async function poll(): Promise<void> {
  if (polling) return;
  polling = true;
  try {
    const res = await fetch(`/api/dev/cms-calls?since=${state.lastId}`, {
      cache: "no-store",
    });
    if (!res.ok) return;
    const data = (await res.json()) as {
      entries: CmsCall[];
      total: number;
      bootTs: number;
    };

    // Dev server restarted → ids reset, start the stream over.
    if (state.bootTs !== null && data.bootTs !== state.bootTs) {
      emit({
        entries: data.entries.slice(-CLIENT_CAP),
        total: data.total,
        bootTs: data.bootTs,
        lastId: data.entries.at(-1)?.id ?? 0,
        resetCursor: 0,
      });
      return;
    }

    if (data.entries.length === 0) {
      if (state.bootTs === null || data.total !== state.total) {
        emit({ total: data.total, bootTs: data.bootTs });
      }
      return;
    }

    const merged = [...state.entries, ...data.entries];
    emit({
      entries: merged.length > CLIENT_CAP ? merged.slice(-CLIENT_CAP) : merged,
      total: data.total,
      bootTs: data.bootTs,
      lastId: data.entries[data.entries.length - 1].id,
    });
  } catch {
    // Ignore — the dev route can blip during HMR; next tick recovers.
  } finally {
    polling = false;
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (timer === null) {
    void poll();
    timer = setInterval(() => void poll(), POLL_MS);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer !== null) {
      clearInterval(timer);
      timer = null;
    }
  };
}

function getSnapshot(): CmsCallState {
  return state;
}

function getServerSnapshot(): CmsCallState {
  return SERVER_STATE;
}

export function useCmsCalls(): CmsCallState {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** Hide everything logged so far (the "current session" reset). */
export function clearCmsCalls(): void {
  emit({ resetCursor: state.lastId });
}

/** Calls still visible after the last Clear. */
export function visibleEntries(s: CmsCallState): CmsCall[] {
  return s.resetCursor > 0 ? s.entries.filter((e) => e.id > s.resetCursor) : s.entries;
}
