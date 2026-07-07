# 3. zero-cms uses a file-system store, no database

Date: 2026-06-28

## Status

Accepted, at the time — the file-system-store decision is superseded by
[ADR 0008](./0008-zero-cms-redis-blob-store.md) (Redis + Blob) and the single-writer
assumption by [ADR 0009](./0009-zero-cms-multi-writer-optimistic-concurrency.md)
(multi-writer, per-entry optimistic concurrency). Kept here as the historical record of
why file-system-and-single-writer was the right call for v1 (no remote editing yet).

## Context

We are building zero-cms, a standalone CMS engine, as an alternative to Strapi. It
must run anywhere, be trivially versionable, and have no infra to provision. The
content scale is CMS-shaped (hundreds to low thousands of entries), not OLTP.

## Decision

zero-cms-core persists everything to one **base directory** on disk — no database:

- `types.json` — the Schema (array of Types).
- `data.json` — all Entries, in a single file.
- `media/` — image/video files, plus `media/index.json` (id → filename, mime, size, dims).

Core loads all of it into memory on bootstrap. Mutations update memory, then
**write-through** the whole `types.json` / `data.json` via a temp file + atomic
`rename` (crash-safe, no partial writes).

Writes are serialized through an **in-process mutex**; we assume a **single writer
process**. No cross-process file locking in v1 — two writers on the same directory is
documented as unsupported.

Reference integrity is enforced in core: an Entry (or media file) can only be deleted
when nothing else references it.

## Consequences

- Zero infra; the store is `git`-diffable and copyable.
- Single-file `data.json` is simple and keeps integrity scans cheap; it will not scale
  to very large datasets — acceptable for CMS content, revisit with per-entry files if
  needed.
- Single-writer assumption must be honored by deployments (one reference server).
- Atomic rename gives crash safety without a WAL.
