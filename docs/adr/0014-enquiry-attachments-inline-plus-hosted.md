# 14. Enquiry Attachments are delivered two ways — inline up to a budget, then hosted links

Date: 2026-07-25

## Status

Accepted. Reuses the Vercel Blob store introduced by [ADR 0008](./0008-zero-cms-redis-blob-store.md) (which added it for CMS media), on the public, unauthenticated enquiry path.

## Context

The Enquiry Wizard's final step lets a visitor attach files, and the client asked for any file type — explicitly including video. Two hard ceilings make a single delivery path impossible:

- **Vercel caps a Function request body at ~4.5 MB.** `POST /api/enquiry` is a Function, so that is the absolute maximum that can ever reach the email code in one request. The previous 10 MB client-side cap was therefore already broken in deployed environments and only appeared to work in `next dev`, which has no such limit — a latent bug this decision also closes.
- **Gmail caps a message at 25 MB**, and base64 inflates bytes by roughly 37%. Even with no platform limit, a 40 MB video could not be emailed.

A phone video is routinely 20–100 MB. So "attach it to the email" cannot be the only answer, and "always send a link" would regress the common case — a 200 KB photo the business currently gets inline, in the email, with no click.

## Decision

Each Attachment is delivered as one of two things, decided per file by a greedy walk in the visitor's own order:

1. **Inline attachment** — added while the running total still fits a fixed 3.5 MB budget (held well under Vercel's ~4.5 MB to leave room for the JSON payload and multipart framing). Sent as a real MIME attachment by `/api/enquiry`, exactly as before.
2. **Hosted attachment** — everything that did not fit. The browser uploads it straight to Vercel Blob via a short-lived client token from `POST /api/enquiry/upload-token`, bypassing the Function body limit entirely, and the enquiry email carries a download link.

Caps: 10 files, 50 MB per file, 200 MB total, enforced client-side on the merged set and re-checked server-side.

Walking in the visitor's order rather than smallest-first is deliberate: the wizard labels each row with where it is going, and silently reordering would make that label look arbitrary.

## Considered options

**Attachments only, with honest caps** (cap the total near 4 MB and reject anything larger) — rejected: it cannot deliver video at all, which was the explicit ask.

**Hosted links only** (every attachment goes to Blob) — rejected: it regresses the ordinary case. A small photo that the business currently receives in the email would become a click, and a link that eventually rots.

## Consequences

- **The upload-token route is a public write endpoint**, so it carries its own guards: the `company_website` honeypot (previously checked by `/api/enquiry` but never actually rendered by the wizard — dead code until now), a per-IP `INCR`/`EXPIRE` rate limit in the Redis we already run, and `maximumSizeInBytes` on the minted token so Blob itself refuses an oversize PUT. The rate limit fails **open** if Redis is unreachable — a storage blip must not take the enquiry form offline.
- **`hostedLinks` arrives from the browser and is untrusted.** Every URL is re-validated server-side against `*.public.blob.vercel-storage.com` before it can reach an email body. Without that check the endpoint would relay attacker-chosen links inside a mail wearing our own branding.
- **Hosted attachments are never pruned.** Blob has no TTL and there is no lifecycle job, so storage accrues for as long as enquiries arrive. Accepted for now given the volume; a sweeper is the obvious follow-up.
- **Hosted attachment URLs are public**, if unguessable. A visitor's kitchen photos are not secrets, but they are not access-controlled either.
- **The two delivery modes are visible to the visitor**, not hidden — each row in the wizard's file list says whether it is being attached or linked, so nobody is surprised by what the business receives.
