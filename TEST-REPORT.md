# Upper Street Contractors — Full Test Sweep Report

**Date:** 2026-07-18
**Environment:** `localhost:3000` (`next dev`), live Upstash Redis `engaging-polliwog-71720` (shared with staging/prod — tested guarded)
**Roles exercised:** Visitor (anonymous), Admin (owner account), Copy writer, Viewer
**Scope:** Public site E2E · CMS dashboard + Inspect mode · all CRUD · API surfaces · role/permission matrix · Lighthouse/responsive quality · vitest risky paths
**Deliverable:** Report only — no GitHub issues filed, no product code fixed. One new test file added (`libs/zero-cms-core/src/lib/server/authorize.spec.ts`).

---

## Executive summary

- **API-level RBAC is solid.** The full role × operation matrix is correct, temp-password lockout works, self-lockout guards hold, and optimistic-concurrency (CAS) is enforced everywhere.
- **But one HIGH bug makes the Content admin dashboard unusable for non-admins** (Copy writer + Viewer) — see F9. This is the headline finding.
- **Public site is healthy**: all routes render, the enquiry wizard works end-to-end, cookie consent gates third-party embeds correctly, SEO = 100 and Best Practices = 100 on every page.
- **Accessibility** is 100 on most pages but dips to 96–98 on three due to a gold-text contrast token issue (F12) and one heading-order slip (F13) — below the repo's stated a11y = 100 standard.
- **All test artifacts were cleaned up and the cleanup was verified** against the live store.

### Findings by severity

| # | Severity | Area | Summary |
|---|----------|------|---------|
| **F9** | 🔴 HIGH | RBAC / dashboard | `getSchemaVersion` missing from RPC role table → Content admin shows "No types yet" for Copy writer + Viewer |
| F3 | 🟠 MED | Enquiry | Attachments never type-validated (client or server) — any file (e.g. `.exe`) is emailed to the business |
| F12 | 🟠 MED | Accessibility | `text-gold` fails WCAG AA contrast on both light (4.16) and dark (3.34) backgrounds |
| F2 | 🟠 MED | SEO | `/rates` and `/repairs-and-smaller-works` have no page-specific `<title>`/description |
| F4 | 🟡 LOW-MED | SEO | Soft-404: `/projects/<bad-id>` returns HTTP 200 + a leaked "Project" title (needs prod-build confirmation) |
| F13 | 🟡 LOW-MED | Accessibility | `/projects` heading-order: card `<h3>` with no preceding `<h2>` |
| F6 | 🟡 LOW-MED | Robustness | `/api/cms/auth` `login` with empty args → 500, leaks internal `.trim()` error |
| F8 | 🟡 LOW | Hygiene | Committed `"TEMP dev-only (revert before commit)"` override in `query.ts` |
| F5 | 🟡 LOW | Robustness | RPC malformed JSON body → 500 (should be 400) |
| F7 | 🟡 LOW | Robustness | `/api/cms/auth` malformed JSON → 500 with null body (unhandled) |
| F10 | 🟡 LOW | SSR | Hydration mismatch in the Inspect overlay (`<p>`→`<div>`), editor-only |
| F11 | 🟡 LOW | Test infra | Root `vitest run` is red — DOM-dependent lib specs lack a jsdom environment (pre-existing) |

---

## Findings (detail)

### F9 — 🔴 HIGH: non-admin Content admin dashboard is empty and unusable

**What happens:** Log in as the Copy writer or Viewer and open the Content admin (`/admin/cms`). The type list reads **"No types yet"**, no entries are browsable, and nothing is editable. The dashboard is effectively dead for every non-admin role.

**Root cause:** `libs/zero-cms-core/src/lib/server/authorize.ts` — the `RPC_MIN_ROLE` table lists `getSchema: 'viewer'` but **omits `getSchemaVersion`**, so it falls to the `?? 'admin'` deny-by-default and returns 403 for any non-admin. The dashboard loads both together at `libs/zero-cms-app/src/lib/context.tsx:119`:

```js
const [next, version] = await Promise.all([
  adapter.getSchema(),
  adapter.getSchemaVersion(),   // 403 for non-admins → rejects the whole Promise.all
]);
setSchema(next);                // never reached → schema stays empty
```

`getSchema` itself succeeds (200 for viewers), but the `getSchemaVersion` rejection takes down the whole `Promise.all`, so `setSchema` never runs.

**Repro:** Sign in as the Copy writer or Viewer → `/admin/cms` → left pane "No types yet"; console shows `403 (Forbidden)` ×2; network shows `POST /zero-cms/rpc {op:"getSchemaVersion"}` → 403 `Requires "admin" role`. Confirmed for both viewer and editor tokens. Admin is unaffected.

**Impact:** The Copy writer role exists to create/edit/publish content, but the Content admin gives them nothing. Inspect-mode (live-page editing at `/admin?inspect=true`) still works as a partial workaround because the widget doesn't call `getSchemaVersion` — but media management and browsing entries by type live only in the dashboard. Almost certainly a regression from the recent "Copy writer role gating" work (commit `41e0ff1`): the new gating never allow-listed this read op.

**Suggested fix (not applied):** add `getSchemaVersion: 'viewer'` to `RPC_MIN_ROLE` (it is a pure read, sibling of `getSchema`), and optionally harden `context.tsx` so a version-fetch failure doesn't blank the schema. A regression test is included — see the Test additions section.

---

### F3 — 🟠 MED: enquiry attachments are not type-validated (client or server)

The enquiry wizard accepts **any** file type as an attachment; only count (≤5) and total size (≤10 MB) are enforced. The `accept="image/*,.pdf,.doc,.docx"` attribute is only an OS-picker hint and is trivially bypassed (drag-drop or programmatic).

- Client: `apps/website/src/components/sections/wizard/wizard.tsx:246` (`handleFiles`) — count + size only.
- Server: `apps/website/src/app/api/enquiry/route.ts:80-91` — count + size only, then `contentType: file.type || "application/octet-stream"` sends whatever was attached.

**Repro:** On wizard step 5, set a `.exe` file on the file input → it attaches with no error; on submit the server would email it to the business inbox.

**Impact:** Arbitrary files delivered to the business inbox (spam/malware-delivery surface), and the stated "images / PDF / Word" contract is silently violated. Exploit severity is modest (goes to their own inbox), but both layers should validate MIME/extension.

---

### F12 — 🟠 MED: `text-gold` fails WCAG AA contrast on both light and dark backgrounds

The gold text token `#906d37` fails AA contrast in two structurally different places, so it is a token-level issue, not one stray element:

- `/rates` (Lighthouse a11y = 96): gold link `<a class="mt-8 … text-gold" href="/">` on cream `#f4f0e7` → **contrast 4.16** (needs 4.5 for 14px text).
- `/projects/[id]` (a11y = 96): meta chip `<li class="… border-gold/35 bg-gold/20 …">` gold `#906d37` on the dark hero `#1f2325` → **contrast 3.34** (needs 4.5 for 12px text).

**Impact:** Below the repo's full-a11y / Lighthouse-100 standard. Home, Contact and Kitchens scored a11y 100, so this is specific to gold-on-contrasting-surface spots. Fix: use a darker gold for small text on light surfaces and a lighter gold (or larger/bolder text) for gold-on-dark chips.

---

### F2 — 🟠 MED: two pages missing page-specific title + meta description

`/rates` and `/repairs-and-smaller-works` render with the bare site-fallback `<title>` = "Upper Street Contractors" and the generic site description, unlike every other page (e.g. `/kitchens` → "Kitchen Installations | Upper Street Contractors").

**Repro:** `fetch('/rates')` → `<title>Upper Street Contractors</title>`. Both are real, content-bearing pages (Rates has `h1="Rates"`; Repairs is linked in the footer nav).

**Impact:** Weaker SEO for two indexable pages. (Lighthouse SEO still scored 100 because it only checks that a title/description *exists*, not that it is unique/descriptive — so this is a real best-practice gap that the score doesn't catch.)

---

### F4 — 🟡 LOW-MED: soft-404 on invalid project id (needs prod-build confirmation)

`/projects/<invalid-id>` returns **HTTP 200** while rendering the "404 - Page Not Found" UI. `notFound()` is called (`apps/website/src/app/(site)/projects/[id]/page.tsx:80`), yet the status is 200 in `next dev`, and the `<title>` leaks as "Project | Upper Street Contractors" (from `generateMetadata` returning `title ?? "Project"`) rather than a 404 title.

**Contrast:** an unknown top-level path (`/nonexistent`) correctly returns 404; real project ids return 200.

**Impact:** Search engines would index junk project URLs as live 200 pages (soft-404). **Caveat:** `notFound()` status handling differs between `next dev` and production in some Next versions — confirm with `npm run build && npm run start` before treating the 200 as a production bug. The leaked "Project" title on the not-found render is real regardless.

---

### F13 — 🟡 LOW-MED: heading-order violation on `/projects`

Lighthouse a11y = 98 on `/projects`; failing audit `heading-order`: a project-card `<h3>` (card title) appears with no preceding `<h2>` — the page goes h1 (page title) → h3 (cards), skipping a level. Screen-reader users lose the hierarchy. Fix: give the card grid a (visually-hidden if needed) `<h2>`, or demote card titles to `<h2>`.

---

### F6 / F5 / F7 — 🟡 bad input returns 500 instead of 400 (robustness)

Unauthenticated clients can trigger 500s with malformed input on the auth/RPC endpoints:

- **F6** — `POST /api/cms/auth {op:'login', args:[]}` → **500** `Cannot read properties of undefined (reading 'trim')` (leaks internal detail; should be 400). `auth.login(undefined, …)` calls `.trim()` on an undefined email.
- **F5** — `POST /zero-cms/rpc` with a non-JSON body → **500** `{code:"CONFLICT", "Unexpected token …"}` (should be 400). `handler.ts` maps the `req.json()` parse error through the non-`ZeroCmsError` → 500 branch.
- **F7** — `POST /api/cms/auth` with a non-JSON body → **500** with a `null` body (unhandled). `apps/website/src/app/api/cms/auth/route.ts:39` runs `JSON.parse(bodyText || "{}")?.op` with no try/catch, so bad JSON throws before the handler's own error mapping.

Well-formed unknown/missing ops are correctly handled (400 VALIDATION); only malformed JSON / missing args escape as 500. No security impact (auth still denies), but wrong status semantics and error-log noise.

---

### F8 — 🟡 LOW: committed "revert before commit" dev override

`apps/website/src/lib/cms/query.ts:61-64`:

```js
// TEMP dev-only (revert before commit): render draft + unpublished CMS content …
const preview = (await isPreview()) || process.env.NODE_ENV === "development";
```

The comment says "revert before commit," yet it is committed on `staging`. Effect: in local `next dev`, every public page renders with `status:draft, includeUnpublished:true` and bypasses the cache, so **unpublished/draft content is visible on normal public URLs in dev**. Production is unaffected (NODE_ENV-gated). Two concerns: (a) code marked for reverting shipped; (b) local dev does not mirror production content visibility, which can mask publish/visibility bugs. (This is exactly why the publish→ISR visibility check was not verifiable in dev.) If the override is intentional, the comment should be corrected.

---

### F10 — 🟡 LOW: hydration mismatch in the Inspect overlay (editor-only)

On `/admin?inspect=true`, the console logs "Hydration failed because the server rendered HTML didn't match the client." The diff is in `InspectClone` / `InspectHost` (zero-cms-widget): the client adds `outline …` inspect decorations and swaps `<p>` → `<div>` (`InspectHost as="div"`) versus the SSR `<p>`, so the markup diverges and React discards and regenerates the subtree. Editor-only (`/admin` preview); the public site is unaffected. Part of it may be dev-only verbosity, but the `<p>`→`<div>` element-type swap is a genuine SSR/client structural mismatch.

---

### F11 — 🟡 LOW: root `vitest run` is red (pre-existing test-infra gap)

`npx vitest run` from the root fails 7 tests across `zero-cms-blocks`, `zero-cms-app`, `zero-cms-widget`, `zero-cms-graphql` with `ReferenceError: document is not defined` and import errors. Only `zero-cms-core` and `zero-cms-graphql` ship a `vitest.config.mts`; the DOM-dependent libs have no jsdom `environment`, so root runs execute them under node. Pre-existing and unrelated to this sweep's one new spec (which lives in `zero-cms-core` and passes). Consistent with the known "lib tooling is incomplete" state.

---

## What was verified working (passed)

**Public site (visitor)**
- All 17 `(site)` routes return 200; unknown top-level path → 404. `robots.txt` disallows `/admin`; `sitemap.xml` (43 URLs) has zero `/admin` entries.
- `/projects`: 26 projects, Category filter narrows correctly (Kitchen, Loft, All). Project detail renders hero, What We Delivered + deliverables, Project Timeline, Similar Work, category badges, no broken images.
- About: 5 FAQ items, single-open accordion enforced. Service page (Kitchens): Page Hero, Service Offer with cost cards, FAQ, case-study cards, breadcrumb, split sections.
- **Enquiry Wizard full flow**: 5-step stepper with back-nav; Image Question single/multi-select; `revealTextInput` shows/hides on select/unselect; Form Question types (text/email/tel/textarea/date via DayPicker/time-window multi-select/boolean/file); Conditional "Company Name" appears only when the company toggle is on; attachment count (>5) and size (>10 MB) rejected; real submit → done panel "Thank you — your enquiry is on its way" + `POST /api/enquiry` 200.
- **Cookie consent**: first-visit banner; Reject → embeds show inert placeholder; Accept (via preferences dialog, with strictly-necessary locked on) → Trustpilot iframe + bootstrap script load; choice persists in the `usc_consent` cookie.
- `/admin/*` unauthenticated → redirect to `/admin/cms` login. Draft cookie cleared on public paths.

**Anonymous API negatives**
- All `/zero-cms/rpc` ops without a token → 401; GET → 405.
- `/api/cms/auth`: `me`/`listUsers`/`createUser` → 401; bad login → 401; well-formed unknown op → 400.
- GraphQL: published reads OK; `status:draft` as anon is **clamped to published** (`resolvers.ts:147,161`) — no unpublished-content leak.
- Media junk id → 404. Enquiry validation: not-form → 400, empty → 400, junk payload → 400, honeypot → 200 silent-accept, GET → 405.

**RBAC / role matrix (the core of this sweep)**
- **Admin**: Users tab visible; user CRUD (create/edit/disable-enable/reset-password) all work; self-demote/self-disable/self-delete all blocked (403); duplicate email → 409; weak password → 400.
- **Copy writer** (editor): temp-password login → forced-change lockout (every op refused until password changed) → change → unlocked; reads + content writes allowed; `saveSchema` and all user-admin ops → 403; Types pane and Users tab show admin-privilege lock screens.
- **Viewer**: all 6 reads → 200; all 11 writes (`create`…`deleteMedia`, `saveSchema`) → 403. Fully read-only.
- Full matrix also codified in vitest (`authorize.spec.ts`).

**Content lifecycle & concurrency**
- create → update → publish (appears in published GraphQL data) → unpublish (dropped from published) → delete (gone). Reference-integrity blocks deleting a referenced entry. Media put → served via `/api/cms/media/[id]` → delete. Draft-on-real-entry isolation: draft edits never touch published; discard restores.
- CAS / optimistic concurrency (ADR 0009): stale token → clean 409 everywhere (users and entries). Disabling a user immediately invalidates their live session (not just future logins). enable-preview / exit-preview roundtrips work; session cookie is httpOnly.

**Quality (Lighthouse desktop, dev build)**

| Page | a11y | Best Practices | SEO |
|------|------|----------------|-----|
| / (home) | 100 | 100 | 100 |
| /contact (wizard) | 100 | 100 | 100 |
| /kitchens (service) | 100 | 100 | 100 |
| /projects (index) | 98 | 100 | 100 |
| /projects/[id] (detail) | 96 | 100 | 100 |
| /rates | 96 | 100 | 100 |

- Responsive: home and /contact at true 375px mobile — no horizontal overflow, hamburger nav collapses, Clients Carousel becomes a static grid below 1024px.
- Performance not scored — a `next dev` build is unrepresentative; run against `npm run build && npm run start` for real perf numbers.

---

## Test additions (only source change)

`libs/zero-cms-core/src/lib/server/authorize.spec.ts` (new) — a full role × RPC-op matrix over `authorizeRpc`, asserting reads are viewer+, content writes editor+, `saveSchema` admin-only, unknown ops deny-by-default, and absent sessions → UNAUTHORIZED. It also pins **F9** with an `it.fails` block: the test currently passes (documenting the bug without reddening the suite) and will start failing the moment `getSchemaVersion` is allow-listed for viewers — the signal to remove the marker.

Result: `npx vitest run libs/zero-cms-core` → 7 files, 48 passed + 1 expected-fail. `zero-cms-core` is fully green.

---

## Cleanup — done and verified

- Both test users deleted → `listUsers` returns the owner only.
- All `ZZ-TEST-` entries gone (both disposable ids `locate` → null; zero in query); zero `zz-test` media.
- The one real entry touched for the draft-isolation test (`3e610158`) restored to its original value, no pending draft.
- Logged out (session cookie cleared), draft-mode cookie cleared, localStorage token removed; public home renders clean; `/admin` redirects to login.
- Only residual on the store: a pre-existing `at-aglance-card` draft (last edited 12:49, before this session) — left untouched as it is not mine. The owner may want to publish or discard it (it shows "Hello world" / "803 samples" / "k22" placeholder text in Draft view).

---

## Follow-ups for the owner

1. **Confirm the two wizard test emails** arrived at `ahmeds.gaafer@gmail.com` (a business enquiry + a confirmation copy).
2. **Confirm F4** with a production build (`npm run build && npm run start`) — the soft-404 status may be a `next dev`-only artifact.
3. **F9** is the one to prioritize — it blocks the Copy writer role you just built.

---

## Fix sweep — 2026-07-18 (post-report)

All 13 findings were re-confirmed in code, then fixed (12) or part-deferred (1). One correction to the report: **F8 was never committed** — the override was an uncommitted working-tree change (`git diff` showed it; the file's last commit predates it).

| # | Action | What was done | Files | Verified by |
|---|--------|---------------|-------|-------------|
| **F9** | ✅ Fixed | `getSchemaVersion: 'viewer'` added to `RPC_MIN_ROLE`; spec folded the op into `READ_OPS` and the `it.fails` block was removed; dashboard schema load now tolerates a version-fetch failure (`.catch(() => null)`) instead of blanking | `authorize.ts`, `authorize.spec.ts`, `zero-cms-app/context.tsx` | vitest role×op matrix green (52 core tests) |
| F3 | ✅ Fixed | Shared images/PDF/Word allow-list enforced **client + server** (MIME + extension fallback); rejects named files client-side, 400 server-side | new `helpers/enquiry-files.ts`, `wizard.tsx`, `api/enquiry/route.ts` | live POST with `.exe` → 400, no email sent |
| F12 | ✅ Fixed | Placeholder-page link `text-gold` → `text-gold-deep` (5.56:1 on cream); project-hero gold chip `text-gold` → `text-gold-mid` (5.51:1 on blended chip bg). No global token change | `placeholder-page.tsx`, `project-hero.tsx` | Lighthouse a11y: /rates 96→**100**, /projects/[id] 96→**100** (chip present on audited page) |
| F2 | ✅ Fixed | Static `metadata` exports (title via the `%s \| site` template, description, canonical) | `rates/page.tsx`, `repairs-and-smaller-works/page.tsx` | `<title>Rates \| Upper Street Contractors</title>` (+ repairs) served |
| F4 | ✅ Fixed (title) / ⏸ deferred (status) | `generateMetadata` now calls `notFound()` when the project is missing — the leaked "Project \|" title is gone. The HTTP-200 half still needs the prod-build check (owner follow-up #2) | `projects/[id]/page.tsx` | junk id no longer emits "Project \|" title (dev still 200, expected) |
| F13 | ✅ Fixed | `<h2 class="sr-only">Project case studies</h2>` heads the projects grid section (h1 → h2 → h3 order restored) | `projects-view.tsx` | Lighthouse a11y /projects 98→**100** |
| F6 | ✅ Fixed | `login` validates both args are non-empty strings → 400 VALIDATION; the `.trim()` TypeError (and its leak) is unreachable | `auth-handler.ts` | new vitest cases (4 arg shapes → 400) + live post-restart: 400 "Email and password are required" |
| F8 | ✅ Reverted | Working-tree override removed per owner's choice (`git checkout` — restored `const preview = await isPreview();`). Local dev again mirrors prod content visibility; drafts remain visible via /admin preview | `query.ts` (back to HEAD) | `git diff` clean on the file |
| F5 | ✅ Fixed | RPC handler guards `req.json()` → 400 `VALIDATION "Invalid JSON body"` (was 500 CONFLICT); JSON `null` body → 400 unknown-op instead of a destructure crash | `handler.ts` | new `handler.spec.ts` (2 cases) + live post-restart: malformed → 400, null body → clean 401 |
| F7 | ✅ Fixed | Same parse guard in the core auth handler **and** the website route's raw `JSON.parse` (logout sniff) wrapped → 400 | `auth-handler.ts`, `api/cms/auth/route.ts` | live malformed POST → 400 + vitest case |
| F10 | ✅ Fixed | `ZeroCmsEntryField` now renders through `wrapWithInspect`: a single DOM-element child is cloned in place (a `<p>` stays a `<p>`, an `<li>` stays a valid list child) instead of being nested in an `InspectHost` `<div>` — removes the structural SSR/client swap (and invalid div-in-ul markup) | `ZeroCmsEntryField.tsx` | code-level + widget suite green under jsdom |
| F11 | ✅ Fixed | Root cause sharpened: **vitest 4 removed `vitest.workspace.ts`**, so root runs executed every spec in one env-less project. Added per-lib `vitest.config.mts` (jsdom + `nxViteTsPaths`) for blocks/app/widget (+ a `ResizeObserver` stub for @dnd-kit), replaced the workspace file with a root `vitest.config.mts` using `test.projects` | 3 new lib configs, 2 `test-setup.ts`, root `vitest.config.mts`, deleted `vitest.workspace.ts` | root `npx vitest run`: **13 files / 70 tests, all green** (was 5 files / 7 tests red) |

**Typecheck:** `tsc --noEmit` clean on the website app and changed libs (the 10 pre-existing `engine.spec.ts` TS4111 errors under the spec tsconfig are untouched — same count before/after).

**Post-restart verification:** `next dev` does **not** hot-swap `libs/` changes (app-level fixes landed live immediately; lib-level ones kept serving stale code even after touching the importing routes). After the owner restarted the dev server, the lib-level fixes were confirmed live:

- `POST /zero-cms/rpc` malformed JSON → **400** `VALIDATION "Invalid JSON body"` (was 500 CONFLICT); JSON `null` body → clean **401** (auth denial precedes dispatch — no crash).
- `POST /api/cms/auth` `{op:'login', args:[]}` → **400** "Email and password are required" (was 500 `.trim()` leak); malformed JSON → **400**.
- **F9 / F10** can only be observed with an authed session (this sweep's cleanup logged all sessions out; `/admin?inspect=true` server-redirects to the login screen when signed out). Both remain pinned by the green unit suites — F9 will self-evidence the next time the Copy writer opens `/admin/cms` (the type list should populate), and F10 the next time an editor loads `/admin?inspect=true` (no hydration-failure console error).
