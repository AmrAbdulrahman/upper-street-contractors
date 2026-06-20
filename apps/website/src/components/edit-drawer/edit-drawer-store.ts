"use client";

import { useSyncExternalStore } from "react";

/**
 * Which entry (and optional field) the edit drawer is currently editing.
 * `documentId` is the Strapi documentId; `typename` is the GraphQL __typename
 * used to resolve the Strapi content type server-side; `focusedField` is the
 * attribute name to auto-focus (null when the whole entry was opened).
 */
export type EditDrawerTarget = {
  documentId: string;
  typename: string | null;
  focusedField: string | null;
};

// Module-level store — no React Context/provider, so wrapping the app tree is
// not required and SSR is preserved. Mirrors the useSyncExternalStore pattern
// already used in strapi-inspection-provider.tsx.
let currentTarget: EditDrawerTarget | null = null;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) {
    listener();
  }
}

export function openEditDrawer(target: EditDrawerTarget): void {
  currentTarget = target;
  emit();
}

export function closeEditDrawer(): void {
  if (currentTarget === null) {
    return;
  }
  currentTarget = null;
  emit();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): EditDrawerTarget | null {
  return currentTarget;
}

function getServerSnapshot(): EditDrawerTarget | null {
  return null;
}

export function useEditDrawerTarget(): EditDrawerTarget | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
