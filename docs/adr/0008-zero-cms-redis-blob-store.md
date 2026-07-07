# 8. zero-cms moves off the file-system store to Upstash Redis + Vercel Blob

Date: 2026-07-05

## Status

Accepted — supersedes the storage-backend portion of [ADR 0003](./0003-zero-cms-filesystem-store.md) (the file-system-store decision itself, not the reference-integrity or crash-safety goals behind it, which still hold).

## Context

Content needs to be edited remotely, from every environment (each developer's local `cms`, staging, production) pointing at the *same* live store — not a per-environment local directory synced by git. All three apps (`website` staging/production, `cms`) now deploy as ordinary Vercel projects: no persistent local disk, no long-lived pinned process anywhere.

We walked two other options first:

- **Google Drive, mounted as a filesystem.** No official Linux client; Railway/Vercel serverless can't mount it. Dead on arrival for anything but a developer's own desktop.
- **Google Drive, via its API as a remote `StoragePort`.** Platform-agnostic, but Drive's API has no conditional-write precondition at all (no `If-Match`/ETag-style precondition on `files.update`) and no way to fetch multiple files' content in one call — Google is discontinuing the global HTTP batch endpoint that would have at least cut round-trips. Would have needed an app-level "accept a narrow race window" compromise plus a manifest-file workaround just to make listing/query tolerable.
- **MongoDB Atlas.** Its HTTP-based Data API — the one clean way to call it from serverless without connection-pool problems — was deprecated and fully removed September 2025. Driver-based TCP connections don't fit a fleet of independent serverless functions well.

## Decision

- **Entries and users** live in **Upstash Redis** (provisioned via the Vercel Marketplace — auto-injected credentials, unified billing, REST-based so it works cleanly from serverless with no connection pooling to manage). One key per entry (`entry:<type>:<id>`), one key per user (`user:<id>`); a per-type set/sorted-set of ids backs `query()`, resolved with a single `MGET` for the matching ids' values — one extra round trip, not one per entry.
- **Media** lives in **Vercel Blob** — same Marketplace/account/billing as everything else, CDN-distributed. Media metadata (dimensions, mime, alt text) mirrors alongside it in Redis (`media:<id>`), pointing at the Blob URL.
- The `Adapter`/`StoragePort` split from ADR 0004 is exactly what made this swap contained — no engine rewrite, just a new `StoragePort` implementation.

## Consequences

- Content is no longer human-browsable as plain files in a folder — Drive's one real advantage, given up deliberately, not asked for.
- Redis gives a genuine atomic compare-and-swap (via a Lua `EVAL` script) that Drive's API could never offer — this is what makes [ADR 0009](./0009-zero-cms-multi-writer-optimistic-concurrency.md)'s race-condition fix airtight rather than "best effort."
- `data.json`/`types/*.json`/`media/index.json`/`users.json` and the whole `.zero-cms-store/` git-tracked directory go away; so does the git-sync-to-`main` mechanism built for the (now abandoned) Railway+git plan.
