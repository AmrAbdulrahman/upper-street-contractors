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

- **Collapse-on-drag needs a scroll correction.** Shrinking every slot shortens
  the document and slides the dragged section out from under the pointer, so the
  list measures the dragged slot before and after collapse and `scrollBy`s the
  difference. That is real machinery a separate screen would not have needed.
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
  change another. Surfaced with an "in N pages" badge at the moment of linking,
  not on the page afterwards.
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
  cannot see what a section looks like while arranging it.
- **Drag the rendered sections at full height.** Simplest possible code, truest
  WYSIWYG — and unusable on a post whose sections are each a screen tall, which
  is exactly why the wireframe drew cards.
- **Blog-only, bespoke in `apps/website`.** Faster and hot-reloads in dev, but
  `page.sections` would have gained nothing and `Type.thumbnail`/`description`
  would have had to live in a website-side lookup table instead of the schema,
  diverging from the CMS as the source of truth.
