# 6. zero-cms entry status uses two orthogonal axes (lifecycle + draft overlay)

Date: 2026-06-28

## Status

Accepted

## Context

zero-cms needs preview-before-publish: editors change content, preview it, then publish.
A naive single `status` enum (`draft | published | unpublished`) derived from whether a
draft exists cannot represent a **live entry that also has pending edits** — editing a
published entry would hide that it is still live. Strapi keeps these separate; we need
the same.

## Decision

Each Entry carries two independent things:

- **`__status`** (stored lifecycle): `published | unpublished`. Is the live `values`
  served as published content? New Entries start `unpublished`.
- **`__draft`** (overlay): `null`, or a **full snapshot** of pending `values`. Its
  presence is the derived **draft** / `hasDraft` state.

All edits (`create`, `update`, `patch`) write to `__draft`; live `values` change only on
`publish`. Transitions:

- `publish(id)` → `values = __draft`, `__draft = null`, `__status = 'published'`
- `unpublish(id)` → `__status = 'unpublished'` (values/draft untouched)
- `discardDraft(id)` → `__draft = null`

Reads take a `status` argument that is a **version selector, not a filter**:

- `published` → live `values`, omitted/null when no published version exists
- `draft` → `__draft` if present else live `values` (preview)
- default `published`

Lifecycle/dirtiness filtering is separate, via the `where` DSL on the exposed
`__status` and `hasDraft` fields. `list({status:'draft'})` excludes entries that are
`unpublished` with no `__draft` (intentionally gone — must not reappear in preview).

Reference integrity: an Entry referenced inside another Entry's `__draft` cannot be
deleted. Publishing is **not** blocked by references to unpublished Entries — each Entry
is statused independently; a `validateRefs(id)` helper surfaces dangling refs as a
warning instead.

## Consequences

- A live entry can carry pending edits and be previewed without going live — the core
  requirement.
- `status` and filtering are decoupled, so preview rendering and "needs review" views
  are both expressible.
- `__draft` is a full snapshot (simple merge/preview), at the cost of storing duplicate
  values for dirty entries — acceptable at CMS scale.
