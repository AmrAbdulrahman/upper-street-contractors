"use client";

import { useSyncExternalStore } from "react";
import type { ConsentCategory } from "./categories";
import {
  getServerSnapshot,
  getSnapshot,
  subscribe,
  type ConsentState,
} from "./consent-store";

/** Subscribe to the whole consent state (choice + modal open flag). */
export function useConsent(): ConsentState {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/**
 * Reactive Consent gate for a single category. Necessary is always granted;
 * an optional category is granted only once its choice is recorded and true.
 * Returns false on the server and first client render (undecided) — embeds
 * render their placeholder until the cookie is read on mount.
 */
export function useHasConsent(category: ConsentCategory): boolean {
  const { choice } = useConsent();
  if (category === "necessary") return true;
  return choice?.[category] ?? false;
}
