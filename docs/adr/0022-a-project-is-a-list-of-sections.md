# 22. A Project is a list of sections

Date: 2026-08-30

## Status

Accepted

## Context

Every other kind of content on this site is a `sections` array an editor
composes in place: a `page` (ADR 0015's Section builder), and a Blog Post, which
was deliberately built that way rather than as a body field. A **Project** was
not. Its content was four owned child lists on the entry itself —
`deliverables` (plus a `deliveredSummary` intro), `projectTimeline`,
`projectImages`, `clientComments` — laid out by route code in a fixed order, in
a two-column body with a sticky sidebar.

That difference was not free:

- **Nothing about a Project could be rearranged.** A case study with no staged
  timeline still printed the heading order the route hardcoded, and a Project
  could not carry a Prose Section, an FAQ or a CTA band the way a Service page
  can.
- **Templates had to mirror the asymmetry.** ADR 0019 made a Template a
  snapshot of real content, and a `template` therefore grew four project-only
  slots beside its `sections` — read by one of three kinds and dead weight in
  the other two. `PROJECT_TEMPLATE`'s `fieldMap` was the only one in the
  codebase that was not `{ sections: 'sections' }`, and every comment about
  Templates had to explain the exception.
- **Two Types said the same thing twice.** A `project-image` and a `figure` are
  both "an image and a caption"; a `client-comment` and a `quote-section` are
  both "a line of copy and who said it". The only thing separating each pair was
  which page it hung off.

## Decision

**A Project keeps its identity fields and holds everything else in
`sections`**, the same union a page holds plus two members only a Project is
offered.

1. **Identity stays on the entry.** Title, Category, Sub-category, location,
   dates, value, rating, occupancy, summary, description, `hero`, `similarWork`,
   `cta`/`sidebarCta`. These are what the card and the page header BOTH read —
   ADR 0016's reasoning for a Blog Post's header — and what Similar Work ranks
   on. A hero section holding its own title would let a card and its page
   disagree.

2. **Content becomes sections.** Two new Types carry what nothing else could:
   `project-scope-section` (What We Delivered: intro + Deliverables) and
   `project-timeline-section` (Timeline Steps). They are on `project.sections`
   and `template.sections` only, never on `page.sections` — they say "this job",
   not "this service".

3. **The other two lists collapse into Types that already existed.** Photos
   become a **Gallery section** of Figures; client quotes become **Quote
   sections**. Minting `project-gallery-section` and `client-comments-section`
   would have been less work than the conversion and would have preserved two
   distinctions that stopped being true the moment a Project became a page of
   sections.

4. **The four Template slots come off.** `PROJECT_TEMPLATE` is
   `{ sections: 'sections' }` like the other two, and a Template is a name, a
   kind and a section list.

5. **Derived chrome stays route-rendered.** The hero band, "Project at a
   glance", Similar Work and the closing CTA are computed from identity fields,
   so they are not sections an editor can delete and leave the page
   contradicting its own card. The glance moved from a sticky 360px aside to a
   band under the hero: full-width sections and a rail cannot share a row, and
   squeezing every section into a column they were not designed for was the
   worse trade.

6. **Existing content is migrated, not asked for again.**
   `scripts/migrate-project-sections.mjs` moves 26 live Projects and the two
   project Templates, re-referencing the same Deliverable and Timeline Step
   entries rather than copying them, and converting each Project image into a
   Figure. It runs additive-first (`--apply`) and drops the old fields only on a
   second, explicit pass (`--drop-fields`), so the two halves can be verified
   apart.

## Consequences

- A Project is editable with the tools every other page already had: insert,
  reorder, remove, and start from a Template.
- One Template shape for all three kinds; the "a Project has no sections"
  caveat disappears from the code and the glossary.
- `project-image` and `client-comment` are retired Types. Their entries are
  still stored and unreferenced — deleting them is a separate, reversible-only-
  by-restore operation and is deliberately not part of the migration.
- A Project's hero is one photo, not a three-up collage of its first three
  Project images. The rest of the photos are a Gallery section, where they can
  be captioned and reordered like anything else.
- The stored values of the dropped fields survive in Redis (ADR 0011 drops
  undeclared keys at read time, it does not delete them), so re-adding a field
  would surface the old content — the migration is undoable in that narrow
  sense.
