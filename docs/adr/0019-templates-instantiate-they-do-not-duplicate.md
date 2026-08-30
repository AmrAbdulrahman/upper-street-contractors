# 19. Templates instantiate, they do not duplicate

Date: 2026-08-30

## Status

Accepted

## Context

ADR 0017 built Duplicate: copy one Blog Post to start another from. It was
asked for as "a template feature", and its glossary entry said as much —
_Avoid_ listed `template` as "the use, not the feature".

The use turned out not to be enough. Duplicate needs an existing post that
already looks like what you want, it carries that post's title and identity into
the copy, and it exists on exactly one index. There was no way at all to create
a Project or a Service, and no reusable *shape* — only reusable *instances*.

So: a real `template` Type. The question was what it holds, and that is where the
content model pushes back:

- A **Blog Post** and a **`page`** are both composed of `sections`, and the two
  section unions are byte-identical.
- A **Project has no `sections` field at all.** Its content is four owned child
  lists — `deliverables`, `projectTimeline`, `projectImages`, `clientComments`.

One `sections` list therefore cannot template all three, and "a template is a
list of sections" is only true for two thirds of the feature.

A second, quieter problem: a Template's root is a `template`, but the thing
created is a `blog-post` / `page` / `project`. `duplicateEntry` copies a root
onto a root of the *same* Type. It cannot express this at all.

## Decision

**A separate `template` Type with kind-specific slots, instantiated by a
different operation from Duplicate — over a shared traversal.**

1. **A `template` Type, not a flagged prototype entry.** The obvious cheap
   alternative was to mark a real Blog Post as a template and run
   `duplicateEntry` on it. Rejected: `/blog` and `/projects` query *all* entries
   of their Type, so every public query, the sitemap and the cache-warm pass
   would each need an `isTemplate` filter, and a single missed one publishes a
   template as real content. A distinct Type is excluded by construction. It is
   also, deliberately, **not** in `page.sections` / `blog-post.sections`
   `allowedTypes` — a Template is not a section and must not be droppable onto
   a live page.

2. **Kind-specific slots on one Type**, not three Types. `kind` is
   `blog | service | project`; only the matching slots are read. Three Types
   (`blog-template`, `project-template`, …) would model the asymmetry more
   honestly, at the cost of three of everything — pickers, glossary entries,
   "save as template" wirings — to express something that behaves identically in
   every respect except which lists it carries. The dead slots on the drawer are
   a real cost, paid once, and named in their field labels.

3. **`instantiateFrom` is its own function, not `duplicateEntry` with flags.**
   The root is created from `seedValues`, never copied, because there is no root
   to copy — the source is a Template and the target is not. Both share
   `createCopier` (`copy-subtree.ts`), so the rules that matter — depth-first
   through references, `shareTypes`, diamonds collapsed, cycles terminated,
   `maxEntries` — have exactly one implementation and one test surface.

4. **The same function runs backwards for "Save as template".** Source and
   target swap; the field map is inverted at the call site. This is why there is
   no separate snapshot code path, and why the website derives one map from the
   other rather than writing both.

5. **Templates are authored only by snapshotting real content.** A Template
   holds `sections`, and the Section builder — the one tool that composes a
   section list visually — lives on a *rendered page*. A Template has no page.
   Authoring one in a drawer means assembling a page blind, through a flat list
   of cards. Snapshotting something the editor has just built and can see gets
   the same artefact with no new editing surface at all.

6. **`shareTypes` and `fieldMap` stay parameters**, for the reason ADR 0017
   gives: which Types are owned and which are standalone is a fact about *this*
   content model, and `libs/zero-cms-widget` has no way to know it.

## Consequences

**Good**

- A template can never leak onto the public site, without a single filter
  anywhere.
- One traversal, so a fix to the copy rules reaches Duplicate, instantiate and
  snapshot together. It is exercised against a real in-memory Engine
  (`createMemoryStoragePort`) rather than mocks — which matters more than usual
  here, because `libs/` does not hot-reload under `next dev`.
- Adding a fourth kind later is a `kind` option plus a slot, not a new Type and
  a new picker.
- Editors build templates with the tool they already use for pages.

**Bad / accepted costs**

- **Dead slots in the drawer.** zero-cms has no conditional fields, so a blog
  Template still shows four empty project lists. Mitigated only by labelling
  them "(project kind)". This is the price of decision 2 and it is visible on
  every template an editor opens.
- **The Template's `sections` `allowedTypes` is a snapshot.** It is read from
  `page.sections` at seed time, so a section Type added later is pickable on a
  page but not in a Template until someone re-runs the seed. The same staleness
  ADR 0017 records for `shareTypes`, and for the same reason: there is no
  compile-time link between the schema and these lists.
- **A Template's `clientComments` deliberately drops `project`'s
  `min: 1, max: 2`.** A template with no client comments is a perfectly good
  template. The bounds are UI-level only (the engine does not enforce
  `min`/`max` on `references`), so nothing breaks — but the two definitions of
  "the same" list now differ, and that will look like a mistake to the next
  reader.
- **Editing a template is still a flat list.** Decision 5 solves *authoring*,
  not revision: reordering a template's sections afterwards means the drawer's
  references editor, with no preview. The rejected alternative — an
  `/admin/templates/[id]` route that renders a template through
  `<PageSections>` — remains the obvious upgrade if that becomes a real
  complaint.
- **A Service is two entries, and only the call site knows it.** Instantiating a
  service Template produces a `page`; the `service-card` that reaches it is
  created separately by the Services index. `instantiateFrom` deliberately does
  not learn about this, which means "create a Service" is not reproducible from
  the library alone.
- **Rejected: prototype entries behind an `isTemplate` flag.** Cheaper by a
  whole Type, and Duplicate would have covered it. But it makes correctness
  depend on remembering a filter in every query anyone ever writes against
  `blog-post` or `project`, and the failure mode is publishing a template.
