# 11. zero-cms handles schema evolution via read-time projection + eager backfill-on-save

Date: 2026-07-06

## Status

Accepted. Builds on [ADR 0008](./0008-zero-cms-redis-blob-store.md) (Redis-backed store, no DB-level schema) and [ADR 0009](./0009-zero-cms-multi-writer-optimistic-concurrency.md) (per-entry optimistic concurrency).

## Context

Redis has no schema of its own — "the Schema" (Types) is one JSON document we interpret in application code (per ADR 0008/live-editable per [type-builder.tsx](../../libs/zero-cms-app/src/lib/type-builder.tsx)). Adding or removing a field on a Type does not, by itself, touch any existing entry's stored `values` blob — every entry created before the change simply lacks (or still carries) the old shape. Something has to reconcile that gap.

## Decision

Two mechanisms, not one:

1. **Read-time projection — always on, no toggle.** `materializeValues()` applies the *current* schema over whatever's actually stored: a field the schema defines but the stored blob lacks gets its default (or `null`); a stored key the schema no longer defines gets dropped from what's returned. Never writes anything — purely a read-side view. Applied before `Where` filtering, so filtering against a newly-added field's default value works correctly. This alone is enough for an editor to see a new field, blank, the moment they open any existing entry — no backfill required for that.
2. **Eager backfill-on-save — optional, per field, decided by whoever adds it.** When an admin adds a field via `saveSchema` and supplies a default, the same mutation walks the Type's existing entries once and writes the default into each one missing it — attributed to that admin (`__lastEditedBy`), same identity as the schema change itself. Each entry's backfill write goes through the normal per-entry CAS (ADR 0009) — if a specific entry is concurrently being edited by someone else at that exact moment, that one entry's backfill write fails closed and is skipped (logged, not retried automatically); the schema change itself still succeeds. Not a single atomic transaction across every entry — each entry's write stands alone, same as any other mutation.

## Considered options

**Auto-write-back on read** (heal an entry's stored shape to match the current schema the first time it's read, so storage organically converges without an explicit backfill) — rejected:
- Turns a cheap read into an occasional CAS-protected write, on a path (page rendering, ISR) that's supposed to stay fast.
- `website`'s production/staging read path is public and anonymous — it must never carry write capability, even a "helpful" one. Read credentials should mean read-only.
- Attribution breaks down: a heal triggered by a random page load isn't "edited by" anyone, but ADR 0009 requires a real identity on every mutation.

## Consequences

- Existing entries never silently drift out of sync with what's *displayed* (projection always covers the gap) — but their *stored* shape only actually catches up when an editor re-saves them normally, or when an eager backfill was requested at the time the field was added.
- A field removed from the schema leaves its old key sitting in Redis until something rewrites that entry (projection hides it from readers either way; a full `update()` naturally drops it since it replaces the whole values object, `patch()` may not since it's a partial merge).
