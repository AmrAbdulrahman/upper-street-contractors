# 13. Cookie consent: functional-only taxonomy, cookie-backed leaf store, per-widget gate

Date: 2026-07-12

## Status

Accepted.

## Context

PECR + UK GDPR (per the [ICO cookies guidance](https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/guide-to-pecr/cookies-and-similar-technologies/)) require prior opt-in consent before any non-strictly-necessary storage/access technology runs, with refusing as easy as accepting, granular per purpose, no pre-ticked defaults, an always-available way to withdraw, and no consent for tech you don't actually use.

Two facts about *this* site shape the design:

1. **The only non-essential technologies today are two third-party review embeds** — the Trustpilot widget (`widget.trustpilot.com`) and the Google reviews / Gizmosauce carousel (`embed.gizmosauce.com`), both loaded via `next/script`. There is **no analytics, tag manager, or advertising** anywhere in the repo. The only first-party cookies are the Editor session (httpOnly JWT, strictly necessary) and the consent choice itself.
2. **The app obeys an SSR "leaf-client-only" rule** — no `"use client"` provider may wrap the app tree; client state lives in leaf components backed by module stores, mounted so they don't run during SSR.

## Decision

- **Taxonomy = Strictly necessary (locked) + Functional only.** No Analytics/Marketing category is shown, because none of that tech exists — showing empty categories would violate the ICO "don't ask consent for what you don't use" line and depress opt-in. Functional gates the two review embeds. The category set is a single source of truth in `apps/website/src/lib/consent/categories.ts`; adding a real Analytics category later is a one-entry change.
- **Consent stored in a first-party cookie `usc_consent`** — `{ v, ts, functional }`, `Max-Age` ~6 months, `Path=/`, `SameSite=Lax`, `Secure` on https, **not** httpOnly (client JS reads/writes it). Chosen over localStorage so the server/proxy can read the choice too — needed to SSR-gate a future analytics tag before it ships to the browser. The cookie is itself strictly-necessary, so writing it needs no prior consent. `v` is a schema version: bumping it (or an unparseable/expired cookie) makes the banner re-ask.
- **Leaf module store + `useSyncExternalStore`, no provider** (`consent-store.ts` / `use-consent.ts`). The store starts "undecided" and only reads the cookie inside `subscribe()` (post-mount); the entry (`cookie-consent.tsx`) additionally gates on a mounted flag, so nothing consent-dependent renders during SSR or the first client render. This is the `dynamic(ssr:false)` leaf pattern expressed with an external store — server HTML and first client render always agree, then the real choice is applied on the post-mount re-render.
- **Per-widget Consent gate.** Each embed calls `useHasConsent("functional")`; when refused it renders an inert `ConsentPlaceholder` (a `block` panel for the big Google carousel, an `inline` pill for the small Trustpilot badges) and **never mounts the `<Script>`** — so a refused visitor triggers zero third-party network requests or cookies.
- **Two-layer UI, refuse == accept.** A slim bottom `CookieBanner` (Reject all / Manage / Accept all, Reject and Accept given identical size and weight) plus a portalled, focus-trapped `CookiePreferences` modal (per-category switches, Escape/backdrop close, scroll lock, focus restore). Reopened anytime from a footer "Cookie preferences" link — the withdrawal route.
- **Withdrawal is best-effort by reload.** Turning a previously-granted category off reloads the page so the gated embeds unmount and set no further cookies. We deliberately do **not** try to delete the third parties' own cookies — they're on the vendors' domains and unreachable from first-party JS. The modal discloses this.
- **No cookie wall.** Content is never gated on consent; refusing only suppresses the review embeds.

## Considered options

- **localStorage instead of a cookie.** Rejected: a future analytics tag couldn't be gated server-side (the tag would still ship to the browser), and the choice wouldn't be visible to the proxy/middleware. The cookie costs nothing extra today and keeps that door open.
- **Full 3–4 category taxonomy (Analytics/Marketing) up front.** Rejected: those categories would be empty, which the ICO calls out as misleading and which pushes users toward blanket-reject. Deferred until the tech actually lands.
- **An app-tree consent provider / context.** Rejected: violates the SSR leaf-client-only rule and would drag the whole tree client-side. A module store keeps consent a leaf concern.
- **Programmatically deleting the vendors' cookies on withdrawal.** Not possible — they're set on `widget.trustpilot.com` / `embed.gizmosauce.com`, cross-domain from us. Best-effort reload + non-reload of the embeds is the honest ceiling.

## Consequences

- Adding analytics (e.g. GA4) later means: one entry in `categories.ts`, gating the tag on `hasConsent("analytics")` (client and/or server via the cookie), and bumping `CONSENT_VERSION` so returning visitors are re-asked for the new category.
- The two review embeds now render a placeholder by default; they only appear after a visitor opts into Functional. Refusing produces no Trustpilot/Gizmosauce requests at all.
- The vendors' own cookies, once set, persist until they expire even after withdrawal — withdrawal stops new loading, not existing third-party cookies. Disclosed in the modal.
- The banner/modal are never server-rendered (mounted-gated), so they add no crawlable DOM and don't affect SEO; CMS-driven section titles around the embeds stay server-rendered.
