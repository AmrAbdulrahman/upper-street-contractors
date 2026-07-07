# 7. Rich `project` type replaces `project-card`; add a `date` field kind

Date: 2026-07-04

## Status

Accepted

## Context

A "project" was stored as a thin **`project-card`** zero-cms type (title, one banner
image, a Category Badge, extra Badges). The `/projects/[id]` detail route re-queried
that same card and rendered its fields larger — there was no richer entity behind it,
so the flow dead-ended on the card. A richer **`project`** type already existed in the
store (summary, body, hero, Category enum, a `related` self-relation) but had zero
entries and was wired to nothing. `CONTEXT.md` already defined a Project as a case study
"shown as a card **and on its own detail page**" with Category tag and Meta chips —
i.e. the card-only model never matched the domain language.

zero-cms also had no date field kind, so begin/end dates had no first-class home.

## Decision

- **Promote and enrich the `project` type** to hold all project data: Category (enum),
  Sub-category, Location, begin/end dates, Project value, summary, description, hero,
  and One-to-Many relations to new child types **`deliverable`**, **`client-comment`**,
  **`timeline-step`** and **`project-image`**, plus a **`similarWork`** self-relation
  (renamed from `related`).
- **Migrate the 3 `project-card` entries into `project` (ids preserved)** so existing
  links and the `recent-work-section` relation stay valid, then **retire `project-card`**
  (type + entries deleted; the legacy Strapi mirror is left untouched and unused).
- **Each consumer selects only what it needs**: a lean `ProjectCard` fragment powers the
  card face (home teaser, Projects index, Similar Work); a `ProjectDetail` fragment on
  the detail page pulls the full set.
- **Duration is derived, not stored** — computed from begin/end at render (zero-cms has
  no computed fields), matching the existing derive-in-component precedent.
- **Similar Work = editor pins + auto**: the `similarWork` relation is honoured first,
  then the closest remaining projects are filled in by a pure ranking helper
  (Category → Location → Duration).
- **Add a first-class `date` field kind to zero-cms** (model, validation, codegen, SDL,
  the field-renderer registry, and the type-builder). It maps to a GraphQL `String`
  (ISO 8601 `YYYY-MM-DD`) — the cheapest correct option, needing no new scalar and no
  resolver changes.

## Consequences

- The detail page is a real case study (hero, meta chips, description, What We Delivered,
  Project Timeline, Client Comments, Project images, Similar Work) instead of a bigger card.
- One project model instead of two; the store schema now carries five new content types.
- `date` is reusable across the CMS; Strapi `date` attributes now migrate to it (while
  `datetime`/`time` stay `text`, since a date-only kind can't hold a time component).
- Editors manage everything inline via Inspect mode, including a native date picker.
