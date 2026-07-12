/**
 * Single source of truth for Consent categories (see CONTEXT.md → "Consent &
 * cookies"). The Cookie Banner, Cookie Preferences modal and the per-widget
 * Consent gate all read from here, so adding a real Analytics/Marketing
 * category later is a one-entry change.
 *
 * ICO/PECR: only categories with technology actually behind them are offered.
 * Today that is "necessary" (exempt, locked on) and "functional" (the two
 * third-party review embeds). No analytics or advertising tech exists yet, so
 * no such category is shown.
 */

export type ConsentCategory = "necessary" | "functional";

/** A named third party / cookie source disclosed to the visitor (transparency). */
export type ConsentProvider = {
  name: string;
  /** Host that serves the script / sets the cookies. */
  host: string;
  note: string;
};

export type CategoryMeta = {
  key: ConsentCategory;
  label: string;
  /** One-line purpose shown in the Cookie Preferences modal. */
  purpose: string;
  providers: ConsentProvider[];
  /** Strictly-necessary categories are always on and cannot be toggled. */
  locked: boolean;
};

export const CONSENT_CATEGORIES: readonly CategoryMeta[] = [
  {
    key: "necessary",
    label: "Strictly necessary",
    purpose:
      "Essential for the site to work — it remembers your cookie choice and, for staff, keeps the editor signed in. These can't be switched off.",
    providers: [
      {
        name: "Upper Street Contractors",
        host: "this website",
        note: "Stores your cookie choice, and a login session for staff editing content.",
      },
    ],
    locked: true,
  },
  {
    key: "functional",
    label: "Functional",
    purpose:
      "Loads third-party review widgets (Trustpilot and Google reviews) so you can see our ratings. These stay off unless you turn them on.",
    providers: [
      {
        name: "Trustpilot",
        host: "widget.trustpilot.com",
        note: "Loads the Trustpilot review widget, which sets Trustpilot's own cookies.",
      },
      {
        name: "Google reviews (Gizmosauce)",
        host: "embed.gizmosauce.com",
        note: "Loads the Google reviews carousel, which sets the provider's own cookies.",
      },
    ],
    locked: false,
  },
] as const;

/** Categories the visitor can actually toggle (everything not locked on). */
export const OPTIONAL_CATEGORIES = CONSENT_CATEGORIES.filter((c) => !c.locked);

export function getCategory(key: ConsentCategory): CategoryMeta {
  const found = CONSENT_CATEGORIES.find((c) => c.key === key);
  if (!found) throw new Error(`Unknown consent category: ${key}`);
  return found;
}
