# 24. Public tab sections use the ARIA tabs pattern

Date: 2026-09-08

## Status

Accepted

## Context

The About page rebuild introduced the first two public sections where clicking a
control swaps which of several panels is shown: the **Story Timeline** (a Year
rail under a full-bleed photograph) and **Value tabs** (a strip of value
labels).

The repo already had visible precedent for "a row of buttons that changes what is
below them", and it is not the tabs pattern:

- `sections/projects/projects-view.tsx` and `sections/blog-index/blog-index-view.tsx`
  use plain `<button>`s carrying `aria-pressed`, inside an element with
  `role="group"` and an `aria-label`. A comment in `projects-view.tsx` says this
  is deliberate.
- The only `role="tablist"` in the codebase is in the CMS admin
  (`libs/zero-cms-app/.../entry-form.tsx`), which a visitor never sees.

Copying the visible precedent would have been the obvious move, and it would
have been wrong. Those chips are **filters**: "Bathrooms" narrows a list that is
still a list, more than one could conceptually be on at once, and the content
below is a result set rather than a panel belonging to the button. `aria-pressed`
says "this toggle is on", which is exactly what a filter chip is.

A Year rail is not that. Exactly one year is selected, selecting another
deselects the first, and the copy underneath belongs to the year — it is not a
filtered view of all six. Announcing that as six independent toggles misdescribes
it, and it gives a screen-reader user no way to know how many years there are,
which one they are on, or that ←/→ will move between them.

The competing worry was consistency: two patterns for what looks like one visual
idiom invites the next section to guess, and guessing `aria-pressed` for
something that is genuinely tabs is the more damaging direction.

## Decision

**A public section whose control selects one of N mutually exclusive panels uses
the WAI-ARIA tabs pattern. A section whose control filters a list keeps
`aria-pressed` buttons in a `role="group"`.**

The test is whether the thing below the control is *a panel belonging to that
control* or *a list the control narrows*.

1. **Tabs get the full pattern**, not just the roles: `role="tablist"` with an
   `aria-label`, `role="tab"` + `aria-selected` + `aria-controls` per button,
   `role="tabpanel"` + `aria-labelledby` per panel, one tab stop for the whole
   strip via roving `tabIndex`, and ←/→/Home/End moving selection with focus
   following it. Half the pattern is worse than neither, because the roles
   promise keyboard behaviour that then is not there.

2. **The keyboard half lives in one place** —
   `apps/website/src/helpers/use-tab-list-keys.ts` — so the second section
   cannot drift from the first. Wrapping is the one thing it parameterises,
   because the ARIA pattern leaves it optional and the two callers genuinely
   differ: Value tabs are peers and wrap; a Year rail is chronological, and →
   off the last year landing on the first reads as a bug.

3. **Controls that select a tab are not themselves tabs.** The Story Timeline's
   prev/next arrows sit over the photograph, outside the `role="tablist"` —
   a tablist's children have to be tabs. At the ends they take `aria-disabled`
   rather than `disabled`, so a keyboard user who reaches the last year does not
   lose focus to the document body mid-interaction.

4. **A selection change that does not move focus needs a live region.** An arrow
   click or a swipe leaves focus where it was, so `aria-selected` on the rail
   announces nothing. Each such section carries one `aria-live="polite"`
   `sr-only` line naming the current panel. Without it the arrows are silent
   controls.

5. **Every panel stays in the DOM**, inactive ones carrying the `hidden`
   attribute. The alternative — rendering only the active panel — would put five
   of six Milestones and four of five Values outside the served HTML, and this
   is an About page whose whole job is to be read.

6. **Images are the exception to (5).** A Story Timeline mounts a Milestone's
   photograph on first visit only. Six stacked full-bleed images all sit inside
   the viewport at once, so `loading="lazy"` would not defer any of them; text
   is cheap to keep, 1920px photographs are not.

## Consequences

- Two patterns coexist for similar-looking strips, and the rule for picking is
  written down rather than inferred from whichever file gets read first.
- The About sections are the reference implementation. A future tabbed section
  copies them, not `projects-view.tsx`.
- `useTabListKeys` is a small shared surface with two callers. If a third
  section needs different key handling (a vertical tablist wants ↑/↓), it grows
  an argument rather than a fork.
- These are the first public sections that are client components for a reason
  other than an editor affordance — the Enquiry Wizard was previously the only
  genuinely stateful one. The cost is real and accepted: the interaction cannot
  be expressed in CSS the way the FAQ accordion (`<details name>`) or the
  Clients Carousel (a CSS marquee) are, because selection has to drive both an
  image and a text panel that are not siblings.
- Panels carry `tabIndex={0}` unconditionally. That is right when a panel has no
  focusable content and harmless-but-redundant when a rich-text body happens to
  contain a link; deciding per render would mean inspecting the blocks.
