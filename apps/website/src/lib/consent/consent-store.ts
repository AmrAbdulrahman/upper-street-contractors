/**
 * Consent choice store — a leaf module store (no React context wrapping the app
 * tree; see the SSR "leaf-client-only" rule). The Cookie Banner, the Cookie
 * Preferences modal and each Consent gate subscribe to it via
 * `use-consent.ts`'s `useSyncExternalStore` hook.
 *
 * The choice is persisted in a first-party cookie (`usc_consent`) rather than
 * localStorage so the server/proxy can read it too (e.g. to SSR-gate a future
 * analytics tag before it ships to the browser). The cookie is itself
 * strictly-necessary, so writing it needs no prior consent.
 *
 * Hydration: the store starts "undecided" (choice === null) and only reads the
 * cookie inside `subscribe()` — i.e. after mount. So server render and the first
 * client render agree (undecided → embeds show their placeholder, banner is
 * gated behind a mounted check in the entry), and the real choice is applied on
 * the post-mount re-render. Never seed from the cookie at module load: that
 * would desync the first client render from the server HTML.
 */

import type { ConsentCategory } from "./categories";
import { OPTIONAL_CATEGORIES } from "./categories";

const COOKIE_NAME = "usc_consent";
/** Bump when the category set changes so stored choices are re-requested. */
const CONSENT_VERSION = 1;
const MAX_AGE_SECONDS = 180 * 24 * 60 * 60; // ~6 months

/** The visitor's decision for every optional category. */
export type ConsentChoice = Record<Exclude<ConsentCategory, "necessary">, boolean>;

type StoredConsent = { v: number; ts: number } & ConsentChoice;

export type ConsentState = {
  /** null until the visitor records a choice (drives whether the banner shows). */
  choice: ConsentChoice | null;
  /** Whether the Cookie Preferences modal is open. */
  prefsOpen: boolean;
};

function allOptional(value: boolean): ConsentChoice {
  return Object.fromEntries(
    OPTIONAL_CATEGORIES.map((c) => [c.key, value]),
  ) as ConsentChoice;
}

// --- module state -----------------------------------------------------------

let state: ConsentState = { choice: null, prefsOpen: false };
const listeners = new Set<() => void>();
let initialized = false;

function emit(): void {
  for (const listener of listeners) listener();
}

function setState(patch: Partial<ConsentState>): void {
  state = { ...state, ...patch };
  emit();
}

// --- cookie I/O --------------------------------------------------------------

function readCookie(): ConsentChoice | null {
  if (typeof document === "undefined") return null;
  const row = document.cookie
    .split("; ")
    .find((r) => r.startsWith(`${COOKIE_NAME}=`));
  if (!row) return null;
  try {
    const parsed = JSON.parse(
      decodeURIComponent(row.slice(COOKIE_NAME.length + 1)),
    ) as Partial<StoredConsent>;
    // Version mismatch → treat as no choice so the banner re-asks.
    if (parsed.v !== CONSENT_VERSION) return null;
    const choice = allOptional(false);
    for (const category of OPTIONAL_CATEGORIES) {
      choice[category.key] = Boolean(parsed[category.key]);
    }
    return choice;
  } catch {
    return null;
  }
}

function writeCookie(choice: ConsentChoice): void {
  if (typeof document === "undefined") return;
  const payload: StoredConsent = { v: CONSENT_VERSION, ts: Date.now(), ...choice };
  const secure =
    typeof location !== "undefined" && location.protocol === "https:"
      ? "; Secure"
      : "";
  document.cookie = `${COOKIE_NAME}=${encodeURIComponent(
    JSON.stringify(payload),
  )}; Max-Age=${MAX_AGE_SECONDS}; Path=/; SameSite=Lax${secure}`;
}

// --- external-store contract -------------------------------------------------

function init(): void {
  if (initialized) return;
  initialized = true;
  const stored = readCookie();
  if (stored) state = { ...state, choice: stored };
}

export function subscribe(listener: () => void): () => void {
  init();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getSnapshot(): ConsentState {
  return state;
}

// Server + first client render: always "undecided", so the two agree.
const SERVER_STATE: ConsentState = { choice: null, prefsOpen: false };
export function getServerSnapshot(): ConsentState {
  return SERVER_STATE;
}

// --- actions -----------------------------------------------------------------

/**
 * A previously-granted optional category has been turned off. We can't delete
 * the third party's own (cross-domain) cookies from here, so the honest,
 * best-effort remedy is to reload: the gated embeds unmount and set no further
 * cookies. Granting more never needs a reload (the embed simply mounts).
 */
function isWithdrawal(prev: ConsentChoice | null, next: ConsentChoice): boolean {
  if (!prev) return false;
  return OPTIONAL_CATEGORIES.some((c) => prev[c.key] && !next[c.key]);
}

function commit(next: ConsentChoice): void {
  const prev = state.choice;
  writeCookie(next);
  setState({ choice: next, prefsOpen: false });
  if (isWithdrawal(prev, next) && typeof window !== "undefined") {
    // Defer so the cookie write + state flush land before navigation.
    window.setTimeout(() => window.location.reload(), 0);
  }
}

export function acceptAll(): void {
  commit(allOptional(true));
}

export function rejectAll(): void {
  commit(allOptional(false));
}

export function saveChoice(choice: ConsentChoice): void {
  commit(choice);
}

export function openPreferences(): void {
  setState({ prefsOpen: true });
}

export function closePreferences(): void {
  setState({ prefsOpen: false });
}

/** Imperative check for non-React callers. Necessary is always granted. */
export function hasConsent(category: ConsentCategory): boolean {
  if (category === "necessary") return true;
  return state.choice?.[category] ?? false;
}

export function getDefaultChoice(): ConsentChoice {
  return allOptional(false);
}
