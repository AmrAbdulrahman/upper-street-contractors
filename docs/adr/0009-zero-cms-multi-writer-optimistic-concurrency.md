# 9. zero-cms supports multiple writers via per-entry optimistic concurrency

Date: 2026-07-05

## Status

Accepted — supersedes the single-writer assumption in [ADR 0003](./0003-zero-cms-filesystem-store.md) ("we assume a single writer process... two writers on the same directory is documented as unsupported"). Extends the `Adapter` interface introduced in [ADR 0004](./0004-zero-cms-pluggable-adapter.md).

## Context

With every environment deploying as independent Vercel serverless functions ([ADR 0010](./0010-vercel-only-deployment-isr.md)) against one shared store ([ADR 0008](./0008-zero-cms-redis-blob-store.md)), there is no longer a single always-on process to serialize writes through an in-process mutex. Any `cms` instance — Railway's old role is gone, but a developer's local `cms`, staging's, or production's — is just another peer writer against the same data, all the time. The Engine's existing write path (`persistData()` blindly overwrites with whatever is in its own in-memory array) would silently clobber a concurrent writer's change.

## Decision

- `Entry` (and the equivalent user/media records) gain three fields: `__createdAt`, `__lastEditedAt`, `__lastEditedBy` — matching the existing `__`-prefixed system-field convention (not plain `createdAt`, which is a user-defined-Type-field collision risk).
- Every mutating `Adapter` method (`create`/`update`/`patch`/`publish`/`unpublish`/`discardDraft`/`delete`, plus the media/user equivalents) takes an **explicit, required caller identity** — a real user id from an authenticated session, or a fixed sentinel (`"system"`, `"migration"`) for non-interactive callers (scripts, codegen). No silent anonymous default.
- Update/patch/publish/unpublish/discardDraft/delete additionally carry the caller's last-seen `__lastEditedAt` for that entry. `create` never conflicts (ids are server-generated).
- The check is **per-entry**, not per-store or per-type — a whole-file/whole-snapshot timestamp was considered and rejected: it would false-conflict two editors touching unrelated entries, which defeats the point.
- The Engine **never trusts its in-memory cache to authorize a write.** Every mutation runs a Redis Lua `EVAL` script that atomically re-reads the entry, compares `__lastEditedAt`, and only then updates + bumps the timestamp — genuine compare-and-swap, not merely a narrowed race window (which is all Google Drive's API could have offered — see ADR 0008). A mismatch fails closed with a `CONFLICT` error; the caller must reload and retry. Reads may still be served from cache.
- The draft/publish two-axis model from [ADR 0006](./0006-zero-cms-draft-publish-model.md) does **not** get separately-tracked timestamps per axis — `__draft` is a full-snapshot overlay, not a diff, so two concurrent edits to the same entry can't be merged safely either way. One unified `__lastEditedAt`/`__lastEditedBy` blocks on *any* concurrent touch to the entry, regardless of which axis it targets.

## Consequences

- Breaking change to the `Adapter` interface: `nodeFsAdapter` (if it survives for any local-only tooling), `httpAdapter`, and the new Redis-backed adapter must all carry the identity + expected-timestamp arguments; `zero-cms-app` and `zero-cms-widget` must hold and resend `__lastEditedAt` through every edit/save/publish action, and surface a "someone else changed this, reload" state on `CONFLICT`.
- A developer publishing from a local `cms` instance participates in the exact same conflict domain as production — not a surprise, a direct consequence of the one-shared-store decision in ADR 0008/0010.
