'use client';

/**
 * How wide the Widget drawer is — one setting for the whole stack, remembered
 * per browser.
 *
 * **One setting, not one per panel.** Stacked drawers fully overlap (it is why
 * the Drawer breadcrumb exists at all), so a wide panel behind a narrow one
 * shows as a band of the parent sticking out from under its own child, which
 * reads as a rendering bug rather than a choice.
 *
 * **Remembered**, for the same reason Inspect mode is (ADR 0018): an editor who
 * widened the drawer to work on a long form has said something about how they
 * want to work, not about that one entry, and re-widening it on every entry is
 * the thing that makes the control not worth using.
 *
 * A module-scope store rather than context: it is read by `Drawer`, which is
 * mounted in several places (the stack, the delete dialogs, the pickers), and
 * threading a provider through all of them to carry one boolean buys nothing.
 * `localStorage` access is wrapped because a private window, a storage-blocking
 * browser, or a thumbnail capture can each throw on the accessor itself.
 */

const KEY = 'zero-cms:drawer-wide';

let wide = false;
let hydrated = false;
const listeners = new Set<() => void>();

function readStored(): boolean {
  try {
    return window.localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

function emit() {
  for (const listener of listeners) listener();
}

export function subscribeDrawerWide(listener: () => void): () => void {
  // First subscriber pulls the remembered value in. Deliberately not read at
  // module scope: this module is imported during SSR, where `window` is absent
  // and a read would either crash or bake `false` into the server snapshot.
  if (!hydrated) {
    hydrated = true;
    const stored = readStored();
    if (stored !== wide) wide = stored;
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getDrawerWide(): boolean {
  return wide;
}

/** The server (and the first client render) always sees the narrow default. */
export function getDrawerWideServer(): boolean {
  return false;
}

export function setDrawerWide(next: boolean): void {
  if (next === wide) return;
  wide = next;
  try {
    window.localStorage.setItem(KEY, next ? '1' : '0');
  } catch {
    // A viewer who cannot store it still gets the width for this session.
  }
  emit();
}
