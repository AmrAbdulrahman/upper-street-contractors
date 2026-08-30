# 21. Entry titles derive from a per-Type chosen field, with a per-entry override outside `values`

Date: 2026-08-30

## Status

Accepted. Builds on [ADR 0006](./0006-zero-cms-draft-publish-model.md) (draft /
publish model), [ADR 0009](./0009-zero-cms-multi-writer-optimistic-concurrency.md)
(per-entry CAS) and [ADR 0011](./0011-zero-cms-schema-evolution.md) (read-time
projection).

## Context

Everywhere the CMS names an entry, it went through twelve lines:

```ts
export function titleField(type: Type): string | undefined {
  return type.fields.find((f) => ['text', 'longtext'].includes(f.__type))?.__name;
}
export function entryLabel(type: Type | undefined, entry: OutputEntry): string {
  const tf = type && titleField(type);
  const v = tf ? entry[tf] : undefined;
  return typeof v === 'string' && v ? v : entry.__id.slice(0, 8);
}
```

Three consequences, all of them visible to editors:

1. **The source field was positional, not chosen.** `contact-detail-item`
   declares `emoji` before `label`; `work-card` declares `emoji` before `title`.
   Both were named by the emoji, and there was no way to say otherwise.
2. **Most field kinds named nothing.** A `figure` (asset + caption), a
   `separator-section` (one `lookup`), a `rich-text-block` (one `blocks` field) —
   each fell through to eight characters of a uuid. A Gallery of eight Figures
   read as eight hex strings.
3. **No escape hatch.** When the derived title was wrong or ambiguous, nothing
   could be typed instead.

Four surfaces did not even use it: the Section builder's drag cards and its
remove-confirm dialog showed the *Type* label (four Prose sections → four cards
all reading "Prose"), and the Template picker had its own `nameField` rule.

Two decisions had to be made: where the field choice lives, and how a per-entry
override is stored.

## Decision

**One resolver, in core.** `entryTitle(type, entry, media?)` in
`libs/zero-cms-core/src/lib/model/entry-title.ts` — pure and synchronous, so the
migration script and the engine specs use it with no React and no DOM (the
`richtext` strip is regex, not `DOMParser`, which exists only in a browser). Its
per-kind branch is exhaustive over `FieldType`, so a new field kind is a compile
error until it says how it becomes a title. Every surface calls it; the app layer
adds only the media library, which it already holds.

**The field choice is per Type** — `Type.titleField`, set in the Types admin
beside `label` / thumbnail / description, offering every field but a relation. A
relation holds entry ids, so titling an entry by one names it after a different
entry.

Absent (or naming a field since removed or made relational) it falls back to the
first `text`/`longtext` — the old rule exactly — so an unset Title field behaves
as the CMS always did, and a rename degrades instead of blanking every title
while an editor works out what happened.

**A title is derived, never stored.** A one-off migration
(`scripts/seed-title-fields.mjs`) sets `titleField` on every existing Type so the
admin shows a real selection, but it does not write a title into any entry: edit
the source field and every place naming that entry follows.

**The override is a reserved entry column, `Entry.__title`, not a Field.** It
sits beside `__status`/`__draft`, is written by its own CAS mutation
(`setEntryTitle`, `editor`+), and is **not draft-gated** — saving it is
immediately what the entry is called.

## Considered options

**The override as a Field auto-injected into every Type** — rejected on four
counts:

- Read-time projection (ADR 0011) drops any stored key the schema does not
  declare, so it *had* to be declared to survive — meaning it would appear in
  every Type's field list in the Types admin, in the Generated client, and in the
  GraphQL SDL, forcing a `cms-schema` regeneration for a string no public page
  reads.
- `saveSchema`'s destructive-edit guard validates the projected values of every
  published entry, so one more declared field is one more thing to validate on
  every schema save.
- It would land in `__draft` and follow publish. A title is editor-facing only;
  gating it behind publish holds a change back from an audience that does not
  exist.
- `EntryForm` has exactly one field filter (`group`, which partitions into tabs)
  and no per-surface notion at all, so a declared field would render in the
  Widget drawer too — the one place this deliberately does not belong.

**Per-entry choice of the source field** (each entry picks which field titles it)
— rejected: every new entry starts unconfigured, and two siblings of one Type can
disagree about what names them. The per-Type choice plus a literal override
covers the same ground with one decision per Type instead of one per entry.

**Snapshotting a resolved title into every entry at migration time** — rejected:
it freezes. Rewording the source field would no longer rename the entry, and
every entry would look manually overridden, killing the derive-from-field
behaviour for all existing content on the day it shipped.

**A real AI summary for `richtext`/`blocks`** (rather than the first three words)
— rejected: it needs an API key, a cache keyed on content, an async loading state
in every consumer including a drag card measured at pointer-down, and a fallback
for when it fails. The opening words tell two passages apart, which is the job.

**Resolving Section-builder card titles eagerly** — rejected: the widget holds
only each child's id and Type, so a title is a fetch, and doing it on inspect
mount fires one request per section on every CMS-driven page for a label most
visits never read. Titles are read when the Reorder outline opens (pointer-down)
or the remove dialog opens, cached per adapter.

## Consequences

- `Type` gained a key, so it had to be added to `withoutStamps` in
  `Engine.saveSchema` — an **allowlist**, not an omit, which silently drops any
  Type key missing from it and never bumps `__updatedAt` for it either. One spec
  covers exactly this, and nothing else catches it.
- `OutputEntry` gained `__title`. The GraphQL layer is untouched, so no SDL
  regeneration and no codegen step.
- The override is its own CAS write, so it bumps `__lastEditedAt` like any other
  mutation. The Content admin merges the response back the way autosave does; a
  caller that does not gets a `CONFLICT` on its next save.
- An `asset` Title field needs the media library passed in. Callers without it
  (a server-side or script context) get `Untitled <Type label>` for such a Type
  rather than a wrong name.
- The picker options cache now holds raw entries instead of finished labels: a
  label depends on the schema and the media library, either of which can arrive
  after the fetch, and caching the finished string froze image-titled Types as
  "Untitled …".
- Choosing a Title field is **Admin**-only (it is a schema edit); typing an
  override is **Copy writer**-and-up (it is content).
