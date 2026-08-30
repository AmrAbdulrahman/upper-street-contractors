# 18. Inspect mode is client state, remembered per browser

**Status:** accepted

Inspect mode used to live in the URL: the edit-mode button did a `router.push` to
add or drop `?inspect=true`, and `sessionStorage` remembered the last choice so a
full page load could restore it. Both halves have been inverted — the flag is now
React state in `CmsInspectShellClient`, the query parameter mirrors it, and the
memory is `localStorage`.

**Why the speed half.** Nothing on the server reads `?inspect=true`. The only
server-side gate under `/admin/*` is Draft Mode, and the overlays are resolved
per-component by `useInspect()` in the browser. So every toggle was paying for an
RSC payload covering the whole route tree in order to change a boolean that the
server never saw — seconds of a dead-looking button on a slow connection, for
nothing. Setting state directly makes the pencils appear on the click. The
parameter is kept, and mirrored with `router.replace(..., { scroll: false })`,
because it is what makes an edit-mode URL shareable and reloadable and it is what
the `/admin/*` link interceptor carries across navigations.

**Why the persistence half.** `sessionStorage` was chosen so edit mode could not
surface in a tab opened days later. The cost of that was an editor coming back
read-only every single time they closed the tab — the state they are almost
never in. The trade is now the other way round: one surprise on a stale tab
against a re-toggle on every visit.

## Consequences

- The preference is shared across every tab on the origin, so a `storage`
  listener syncs open `/admin` tabs rather than letting two of them silently
  disagree until one navigates.
- Inspect still starts `false` on the server and on the first client render — the
  restore runs in an effect, and `useInspect`'s hydration invariant
  (`use-inspect.spec.tsx`) is unchanged. Seeding state from storage during render
  would reintroduce the structural hydration mismatch that hook exists to avoid.
- The `inspectRestored` module latch matters more, not less: with a persistent
  preference, a restore that ran twice would undo "turn off edit mode" a frame
  after every click.
- Blocked storage (private mode) still degrades to "works, but is not
  remembered". It must never throw.

## Rejected

- **A cookie instead**, readable in `proxy.ts` so the very first server render is
  already correct. It would be the right answer if the server rendered anything
  differently for inspect mode — it does not, so a cookie would buy a round trip
  we no longer make, and cost a header on every request.
- **Storage swap alone**, which is what was originally asked for. It fixes
  persistence and changes the toggle's speed not at all; the two are unrelated
  problems that happened to be reported as one.
