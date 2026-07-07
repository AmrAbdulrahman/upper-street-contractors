# 10. cms and website deploy on Vercel only; production uses ISR, not a static export

Date: 2026-07-05

## Status

Accepted — supersedes the Railway-based deployment plan (the `cms`-on-Railway runbook, `docs/cms-railway.md`, is now obsolete) and the "production is intended to eventually build as `output: 'export'`" note in `docs/agents/project-stack.md`.

## Context

`cms` was originally planned for Railway specifically because it needed a persistent local disk and a pinned single-writer process to own the file-system store. [ADR 0008](./0008-zero-cms-redis-blob-store.md) (Redis + Blob) and [ADR 0009](./0009-zero-cms-multi-writer-optimistic-concurrency.md) (multi-writer, per-entry optimistic concurrency) removed both reasons — nothing about `cms` needs a long-lived process or local disk any more.

Separately, production's static-export plan was built around content only reaching production via a git push to `main` — a point-in-time snapshot, so baking it at build time made sense. With Drive/Redis as a live, always-reachable backend, that reason evaporated too, but static export still has a real, independent motivation: raw serving performance (no per-request compute).

## Decision

- All three apps — `website` staging (preview), `website` production, and `cms` — deploy as ordinary Vercel projects. No pinned replica, no always-on requirement, no persistent volume anywhere.
- Production **does not build `output: 'export'`.** It uses **ISR**: pages render statically at build time wherever enumerable (`generateStaticParams`, as today), served from cache — visitor-facing performance is effectively the same as static export. On publish, `cms` calls a resurrected `POST /api/revalidate` on `website` (secret-protected via `REVALIDATE_SECRET`, reintroduce in `.env.example`) which calls `revalidatePath("/", "layout")` — a **blunt, whole-site invalidation**, not scoped per changed entry.
- Any `cms` instance that handles a publish — including a developer's local one — makes this same call. Staging never needs it (already SSR/live, no cache to invalidate).
- A brand-new entry (a route that didn't exist at the last build) still resolves on first visit via `dynamicParams` (default `true`) and gets cached from then on — no rebuild needed even for entirely new content, only for actual code changes.

## Considered options

- **Keep full static export.** Rejected: every publish needs a full rebuild+redeploy (minutes, not seconds) — reintroducing the exact staleness this whole effort was meant to remove.
- **Precise, per-route invalidation** (reverse-walking references from the published entry up to whatever Page/route consumes it, via the engine's existing `findReferencesTo`). Rejected for now: real new engineering (multi-hop graph walk, entry→route mapping, entries that fan out to every route like site config) to save a whole-site revalidate that's already cheap at this content scale (hundreds of entries, per ADR 0003). Revisit if the site grows enough that it matters.

## Consequences

- `docs/cms-railway.md` is fully obsolete — delete it when this is implemented.
- `docs/agents/project-stack.md`'s "production intended to build `output: 'export'`" line needs updating to reflect ISR.
- `REVALIDATE_SECRET` needs to exist in `.env.example` again — it was removed during the Strapi cleanup on the (then-correct) assumption nothing called it.
