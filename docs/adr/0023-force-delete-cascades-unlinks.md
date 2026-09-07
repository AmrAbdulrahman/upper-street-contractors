# 23. Force delete cascades its unlinks, published values included

Date: 2026-09-08

## Status

Accepted

## Context

zero-cms Reference integrity refuses to delete an Entry while anything still
points at it, and counts references inside another Entry's `__draft` as well as
its live `values`. The refusal is right — it is what stops a Gallery section
losing its photos to a stray click — but it had no way through, and the states
it produces are ordinary rather than exotic:

- A section removed from a page is still held by that page's **published**
  version until the page itself is published. This is the commonest refusal
  there is, and `RemoveSectionDialog` already existed to explain it.
- A Button, a Figure or an accreditation shared across several pages cannot be
  retired without visiting every page that holds it, in the right order, and
  publishing each one.
- An editor who has decided a piece of content is wrong has no way to act on
  that decision from the page they are looking at. The only route was the
  Content admin, where the same refusal waited.

Retiring the site's WhatsApp Buttons made this concrete: three entries, each
held by published CTA bands, none deletable by any sequence of steps available
in the CMS.

## Decision

`Engine.delete` takes a `force` flag. With it set, and inside the same mutex the
ordinary delete already runs in, the engine strips the target's id out of every
field `findReferencesTo` names — a `references` array filtering it out, a
`reference` becoming `null` — and then deletes the Entry.

Four choices inside that, each with a live alternative:

1. **It writes live `values`, not only `__draft`.** Draft-only unlinking was the
   safer-sounding option and was rejected on the evidence: the holder's own
   published version is the single most common blocker, so a draft-only force
   would refuse most of the deletes it was added to allow. The consequence is
   real and is the reason for the confirmation below — forcing a delete changes
   what visitors see on pages the editor was not looking at.

2. **It does not validate the result.** `assertValid` would refuse to write a
   holder whose *required* relation has just been emptied, which leaves the
   Entry exactly as undeletable as before. Stripping a required relation is the
   operation, not a mistake in it.

3. **It is server-side, not a loop of client patches.** The client alternative
   was available — the refusal already carries the holders as `ReferenceHit[]`,
   and `mutateParentField` already does CAS-safe patches — but it would run N
   writes outside the mutex, racing anything else editing those entries, with a
   partial failure leaving the caller unable to say what it had done.

4. **It is offered only after a refusal has named the holders.** The dialogs
   attempt the ordinary delete first and render the holders as a list, one line
   each, before showing the Force button. This is why `describeReferenceHits`
   grew a `describeReferenceHolders` beside it: a sentence naming six pages is
   not a thing an editor reads before pressing a red button.

## Considered options

- **Unlink from drafts only** — rejected: see (1). It cannot clear the case it
  would most often be used for.
- **Client-side loop of `patch` calls** — rejected: see (3). Racy, not atomic in
  any useful sense, and it cannot report honestly on a partial failure.
- **A pre-check RPC exposing `findReferencesTo`** — rejected as unnecessary: the
  refusal already returns the hits, and a pre-check would have to be re-run
  before the delete anyway, since anything can take a new reference in between.
- **Leave it refused, document the manual order** — rejected: it is the status
  quo, and the WhatsApp retirement shows the manual order is not always
  reachable at all.

## Consequences

- Deleting content can now change pages the editor was not editing. The named
  list is the whole mitigation, and it is why the button says how many holders
  it will rewrite.
- The operation is **not atomic**: a failure part-way leaves some holders
  unlinked and the target alive. It is idempotent, so re-running finishes it,
  and the target surviving is the safe half to fail on.
- A required relation can end up empty, and its Entry will fail to publish until
  an editor fills it. That is a visible, fixable state; the alternative was an
  undeletable Entry, which is not.
- Seed scripts get the same capability through the adapter, which is how the
  WhatsApp Buttons were retired (`scripts/seed-retire-whatsapp-buttons.mjs`).
- Direct writes do not fire `revalidateTag`, so a forced delete run from a script
  leaves public pages stale until their own revalidation window passes.
