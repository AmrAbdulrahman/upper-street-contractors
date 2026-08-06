# 15. In-place Section builder over a separate builder screen

Date: 2026-07-25

## Status

Accepted

## Context

Every page on this site is a CMS `page` whose `sections` is an ordered
`references` field, and every route rendered it as a bare `sections.map(...)`.
An editor could therefore change what a section **said** (each section
self-wraps in `<ZeroCmsEntry>`, which gives it a hover pencil) but could not
change which sections a page **had** — no add, no remove, no reorder, anywhere
on the site. The one "+ Add" affordance that existed, `widget.openCreate`,
hardcoded `allowedTypes[0]`, so a field accepting twenty section Types could
only ever create the first.

The Blogs feature needed all of it, and a Blog Post is structurally the same
thing as a page: an ordered list of section references. So the question was not
"how do we build a blog editor" but "where does list editing live, and what does
it look like".

The wireframe that prompted this drew a **separate builder screen**: a list of
compact cards (thumbnail, Type name, description) with pencil/trash per row,
insert bars between rows, and its own Preview/Publish header — essentially what
every other CMS ships.

## Decision

**One generic capability in `zero-cms-widget`, rendered in place.**

1. **Generic, not blog-specific.** `<ZeroCmsSectionList>` works over any
   `references` field. `blog-post.sections` was its first consumer; all 14
   CMS-driven page routes adopted it in the same change via a shared
   `<PageSections>`.

2. **In place, not a separate screen.** Sections render for real. Insert slots
   sit between them, each section's existing hover cluster grows a trash button
   beside its pencil, and a drag handle reorders. The wireframe's cards survive
   as the **drag representation only**: on drag start every slot collapses to its
   card, so a screen-tall hero is movable, then expands on drop.

3. **Two removal outcomes, not one.** *Remove from the page* unlinks; *Delete
   permanently* unlinks then deletes.

4. **`Type.thumbnail` is a glyph key, not a media id.** It indexes an inline-SVG
   registry shipped with the code.

5. **A Type picker in front of the create drawer**, replacing
   `allowedTypes[0]`, offering create-new and reuse-existing per Type. Reached
   from the Insert slots *and* from a Relation field's "+ Add…" inside an Edit
   drawer, through `ReferenceActions.pickReference` — the drawer previously
   rendered one "add new <Type>" button per Allowed type, which is 23 buttons on
   a page's `sections` and was the single worst piece of UI the feature touched.

## Consequences

**Good**

- The stored order **is** the rendered order, so there is nothing to keep in
  sync and no second surface to authorise, route or style. It also means an
  editor sees the actual result of a reorder rather than an abstraction of it.
- No new glossary concept beside Inspect mode ("the in-page editing overlay") —
  the builder is a thing Inspect mode can now do.
- A public page is byte-identical to before: with inspect off,
  `<ZeroCmsSectionList>` returns its children in a bare fragment — no wrapper
  element, no classes. This is what made a same-day, site-wide rollout
  defensible, and it is asserted in `SectionBuilder.spec.tsx`.
- Every later section Type is a pure additive change: schema + component +
  fragment + union entry + a glyph. No builder work.

**Bad / accepted costs**

- **Collapse-on-drag cannot happen in flow at all.** Shrinking every slot shortens
  the document and slides the dragged section out from under the pointer. It took
  two failures to establish that no in-flow arrangement fixes this:

  1. **`scrollBy` the difference** — measure the dragged slot before and after
     collapse and correct the scroll. Wrong, and unfixably so: collapsing twenty
     screens to one drops the maximum scroll offset far below where the editor was
     standing, so the browser **clamps** `scrollY` and the offset the correction
     wanted to restore no longer exists. On a long page it threw the editor to the
     bottom, which read as the drag teleporting them.
  2. **Reserve the height, offset the stack** — pin `min-height` so the document
     never shrinks (no clamp, no forced scroll: verified as zero `scrollBy`/
     `scrollTo` calls) and push the collapsed cards down with `padding-top` so the
     grabbed one keeps its place. Correct for that one card and useless for the
     rest: padding shifts *every* card equally, so grabbing a section low on the
     home page shoved the nine above it out of position into a cluster below a
     ~2300px blank gap. The editor keeps their scroll position and loses the order.

  The general result: collapsing N sections from ~900px to ~78px **must** move every
  card but one, so the collapse stops being a reflow. The list lifts out of flow
  into the **Reorder outline** — fixed, viewport-capped, internally scrollable,
  over a dimmed page — with a spacer holding its place in the document. The
  outline's internal scroll is set so the grabbed card lands on the pixel it was
  grabbed from (`outlineScrollTop`), which preserves the editor's place *and* keeps
  dnd-kit's cached source rect valid; going full-bleed rather than a narrow centred
  panel is part of the same argument, since it leaves the card's horizontal box
  alone too. The geometry is a pure function because dnd-kit needs real pointer
  capture and an `IntersectionObserver`, so the drag itself cannot be exercised
  under jsdom.

  This lands close to the separate outline builder screen rejected below — but only
  close. It exists for the duration of one gesture, so there is still no second
  route to authorise, style or navigate to, and the editor still sees the real
  sections at every other moment. The rejection of a standing builder screen
  stands; what it gained was borrowed for the two seconds a drag lasts.

- **The collapse has to happen before dnd-kit measures**, which is why it runs on
  `onPointerDownCapture` + `flushSync` rather than in `onDragStart`. dnd-kit's
  default feedback clones the dragged node and positions the clone from a box
  measured at activation; collapse after that and a screen-tall snapshot of a
  section that no longer exists follows the pointer, over an outline of cards.
  Capture phase beats dnd-kit's own listener on the handle and `flushSync` commits
  inside the same event, so activation measures the card. The cost is a
  `dragStarted` ref plus one-shot `pointerup`/`pointercancel` listeners: a plain
  click on a handle gets no `onDragEnd`, and without them it would leave the page
  collapsed.

  **Rejected: `feedback: 'none'`** to avoid the mis-placed preview entirely. It
  reads as the obvious fix — the grabbed card stays in flow, nothing to position —
  and it silently stops the list sorting at all. Confirmed with identical synthetic
  pointer drags in a browser: reorders under `clone`, does nothing under `none`.
  `move` sorts but fixes the real element to the viewport at the same stale origin.
- **The drag handle cannot live in the hover cluster.** The cluster is mounted
  only while hovered and hover flips during a drag, which would pull dnd-kit's
  pointer capture out from under an in-flight drag. The handle therefore belongs
  to the slot and is always mounted in inspect mode — one more always-visible
  control per section than the design implies.
- **`about` lost a code-level reordering.** It used to pull the FAQ out of
  `sections` and re-render it last. A builder computing insert and drag indices
  from the stored order cannot coexist with a rendered order that differs, so
  that hoist is gone; the Trustpilot dev scaffolding moved to the page foot as a
  result.
- **`Type.thumbnail` needs a code change for a new glyph.** Judged hollow: a new
  section Type already needs a component, a fragment and a union entry before it
  renders at all, so it is never a no-code operation and the glyph rides along —
  in exchange for a thumbnail that cannot 404, be deleted out from under a Type,
  or cost network bytes.
- **Reuse makes shared sections possible**, so editing a section on one page can
  change another. Surfaced with a "used in N pages" badge at the moment of
  linking, not on the page afterwards.
- **Rejected: a `referencesTo` pre-check** for the delete button. There is no
  adapter op that answers "who references X" (`findReferencesTo` is
  engine-internal), and adding one means an RPC plus an authorize entry for a
  nicer button state. The delete is attempted and the refusal explains itself
  from the error's own hits.
- **`useEntryOptions` needed a `loading` flag.** The picker branches on whether a
  Type has entries to reuse, and with 23 Types that is 23 queries — reading
  `options.length === 0` mid-fetch reported "nothing to reuse" for a Type with
  plenty and silently skipped the reuse step. Any caller that *branches* on
  emptiness (rather than just rendering a list) has to wait for that flag.

## Alternatives considered

- **A separate outline builder screen** (the wireframe). Best drag ergonomics
  and clearest overview, but a second surface that is not the page: its own
  route, auth and styling, a new concept beside Inspect mode, and the editor
  cannot see what a section looks like while arranging it. (Its ergonomics were
  eventually needed after all — see the Reorder outline above, which borrows them
  for the duration of a drag without becoming a surface.)
- **Drag the rendered sections at full height.** Simplest possible code, truest
  WYSIWYG — and unusable on a post whose sections are each a screen tall, which
  is exactly why the wireframe drew cards.
- **Blog-only, bespoke in `apps/website`.** Faster and hot-reloads in dev, but
  `page.sections` would have gained nothing and `Type.thumbnail`/`description`
  would have had to live in a website-side lookup table instead of the schema,
  diverging from the CMS as the source of truth.
