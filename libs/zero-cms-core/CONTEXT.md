# zero-cms

A standalone, file-system-backed CMS engine. No database — a directory on disk is
the whole store. Reads/writes a schema, data, and media library from one base
directory, and generates a typed client from the schema.

This is a **separate bounded context** from the Website/Strapi glossary in the root
`CONTEXT.md`. Words like Entry, Field, Type, and drawer are redefined here and do
**not** carry their Strapi meaning.

## Language

**Base directory**:
The single on-disk directory zero-cms is pointed at (the config's `dir`). Holds the
type files (under `types/`), `data.json`, and `media/`. The library loads from and
saves to it; there is no other store.
_Avoid_: workspace, project dir, root (ambiguous)

**Config** (`zero-cms.config.mjs`):
The config file exporting `{ dir, generated, types, typesDir }`. `dir` defaults to the
config's own directory. Resolved by `loadConfig` (walks up from cwd).
_Avoid_: settings, options file

**Schema**:
The set of Types that defines the shape of all content, spread across **type files**
(one Type per file) matched by the config `types` glob (default `types/**/*.json`).
A legacy single `types.json` is still read and migrated to per-type files on first save.
Drives type and client generation.
_Avoid_: model file, types.json (now plural)

**Type file**:
A JSON file holding one Type. Edits write back to the file the Type came from; new
types are written to `typesDir` as `<__name>.json`.
_Avoid_: schema file

**Generated directory** (`generated`):
The config-driven output folder for the generated client (importable, e.g. via a
`@cms` tsconfig alias). Refreshed by `generate` / `watchFromConfig`.
_Avoid_: dist, build dir

**Type**:
One schema entry describing a content shape. Has a unique `__name` (drives generated
type + store names) and a set of Fields.
_Avoid_: content-type (Strapi term), model, table

**Field**:
One attribute of a Type. Has a `__name` unique within its Type, a `__type`, and
metadata (e.g. `required`).
_Avoid_: column, property, attribute

**`__type`** (field kind):
One of: `text`, `longtext`, `richtext`, `slug`, `user`, `blocks`, `number`, `json`,
`boolean`, `date`, `asset`, `lookup`, `color`, `reference`, `references`.
- **richtext** — an HTML/markdown string. **blocks** — structured rich text
  ({@link BlocksContent}, Strapi-blocks-compatible) rendered by `@usc/zero-cms-blocks`.
- **slug** — a URL segment: lowercase words joined by hyphens, validated on every
  write (not only on publish — an invalid slug is a broken URL, not an incomplete
  value). Meta `from`: a field `__name` on the same Type to derive from. The app's
  editor mirrors that field's slugified value while the slug is blank and stops
  permanently once it is typed in, so rewording a title cannot move a live URL.
- **user** — a person, stored as the display **name** of the CMS user chosen when
  the value was set, never a user id. Users are not Entries, so a stored id would
  need a read path over `users.json` to render; the name is the publishable part.
  Not validated against the current user list — the person may since have been
  renamed or removed, and the old credit is still what was true.
- **number** — numeric. Meta `integer`, `min`, `max`. **json** — any JSON value.
- **date** — a calendar date stored as an ISO 8601 string (`YYYY-MM-DD`); a `String` in GraphQL.
- **asset** — points at a file in `media/`. Meta `accept`: `image | video | any`. In
  GraphQL it resolves to a **Media** object (`id, url, alt, width, height, mime, kind`).
- **lookup** — text constrained to a predefined set. Meta `options: string[]`.
- **color** — a hex colour (`#rgb`, `#rrggbb` or `#rrggbbaa`), validated on every
  write like a `slug`, because a malformed colour is a broken style rather than
  an incomplete value. Edited with the native picker plus a hex box — the picker
  alone cannot express "unset" (it reports `#000000` when empty, which would
  write black into every optional colour an editor merely opened). Hex only:
  `rgba()`/`hsl()`/named colours each need their own parse path and the picker
  cannot produce them. Meta `presets: string[]` offers swatches. A `String` in
  GraphQL, so it drops straight into a style with no conversion step.
- **reference** — holds one Entry id of an allowed target Type. Meta `allowedTypes`.
- **references** — holds an array of Entry ids; targets may mix allowed Types. Meta `allowedTypes`.

**Entry** (data instance):
One content instance, stored in `data.json`. Carries its `__type` (the owning Type's
`__name`), an auto-generated uuid `__id`, the live `values` keyed by Field `__name`,
a `__status` (lifecycle), and a `__draft` (pending edits overlay, or `null`).
_Avoid_: document, record, row, node

**`__status`** (lifecycle):
Stored, one of `published | unpublished`. Whether the Entry's live `values` are served
as published content. New Entries start `unpublished`.
_Avoid_: state (ambiguous with draft)

**`__draft`** (draft overlay):
`null`, or a full snapshot of pending `values`. All edits land here; live `values` only
change on **publish**. Presence of a `__draft` is the derived **draft** state.
_Avoid_: diff, patch, revision

**hasDraft**:
Derived, queryable flag: `__draft !== null`. Filter for "has pending edits / needs review".
_Avoid_: dirty, modified

**Status (read version)**:
The `status` argument to `get`/`list`/`query` selecting which version to materialize —
not a filter. `published` → live `values` (omitted/null when no published version
exists); `draft` → preview (`__draft` if present, else live `values`). Lifecycle/dirtiness
filtering is done separately via `where.__status` / `where.hasDraft`.
_Avoid_: preview mode (a Website/Strapi-context term)

**Publish / Unpublish**:
`publish(id)` → `values = __draft`, `__draft = null`, `__status = 'published'`.
`unpublish(id)` → `__status = 'unpublished'`, `values` and `__draft` untouched.
`discardDraft(id)` → `__draft = null` (abandon pending edits).
_Avoid_: go live, take down

**Data store** (`data.json`):
The flat collection of all Entries across all Types.
_Avoid_: database, table

**Media library** (`media/`):
The directory of image and video files that `asset` Fields point at.
_Avoid_: uploads, assets dir

**Store**:
The generated, per-Type client object exposing the operations on its Entries:
`create`, `update`, `patch`, `delete`, `get`, `list`, `query`, `publish`, `unpublish`,
`discardDraft`. Edits (`create`/`update`/`patch`) write to `__draft`, never to live
`values`. One Store per Type.
_Avoid_: repository, DAO, model

**Reference integrity**:
The rule that an Entry can only be deleted when nothing references it. References inside
another Entry's `__draft` count — you cannot delete an Entry referenced by a pending
draft. Publishing is **not** blocked by references to unpublished Entries; each Entry is
statused independently.
_Avoid_: cascade, foreign key

**Generated client**:
The `.ts` output produced from the Schema: the per-Type types and Stores that
consumers import. Regenerated on schema change (watch mode).
_Avoid_: SDK, bindings

**Locate**:
Resolve an Entry's Type (`__name`) from its `__id` alone — `adapter.locate(id)`. Lets
the in-place widget open an Entry knowing only its id.
_Avoid_: find, lookup (ambiguous)

**Widget drawer**:
The zero-cms-widget slide-over that edits one Entry in place (by `__id`) without leaving
the host app, reusing the same field renderers and draft/publish actions as the app.
_Avoid_: modal, popover, Edit drawer (the Website/Strapi-context term)

## Section builder

**Section builder**:
The in-place editor for an ordered `references` Field — it makes the LIST editable,
not just each Entry in it: insert at any position, remove, and drag to reorder, all
writing straight to the parent's `__draft`. Wraps the host's already-rendered items
(`<ZeroCmsSectionList>`), so the page stays WYSIWYG. Renders its children untouched
whenever inspect is off, which is what lets it sit on every page.
_Avoid_: page builder, block editor, repeater, outline view (a rejected alternative)

**Section slot**:
One item's place in a Section builder — the sortable wrapper holding a rendered item,
its always-mounted drag handle, and the compact card it collapses to mid-drag. The
handle belongs to the slot rather than the hover cluster precisely because the cluster
unmounts on pointer-out, which would drop an in-flight drag.
_Avoid_: row, item wrapper, placeholder

**Reorder outline**:
What the Section builder collapses *into* for the duration of a drag: the list lifts
out of flow into a fixed, viewport-capped, internally scrollable panel of cards over a
dimmed page, with a spacer holding its place in the document. The panel is scrolled so
the grabbed card sits on the exact pixel it was grabbed from — which keeps the editor's
place and also keeps dnd-kit's cached source rect valid. Nothing in the document moves,
no scroll position is read or written, and the order is untouched until the pointer
actually moves. Lives for one gesture; there is no reorder *mode*.

Opens on pointer-down rather than on drag start, because the drag library measures the
node it animates at activation and has to find the card already there.

Collapsing in flow cannot achieve this, and two attempts established why: shrinking
twenty screens to one **clamps** the scroll position, so a compensating scroll offset
no longer exists (the page jumped to the bottom); and reserving the height while
offsetting the stack pins the grabbed card but displaces every other one, because
padding shifts them all equally.
_Avoid_: collapse anchoring (the superseded in-flow attempt), scroll anchoring (the browser feature a scroll correction misused), reorder mode (it is drag-scoped), outline builder screen (a rejected separate route — see ADR 0015)

**Insert slot**:
The dashed "+ Add" bar the Section builder puts before the first item, between every
pair, and after the last — so a new Entry lands where it was clicked rather than always
at the end. Hidden while a drag is in progress.
_Avoid_: add button (the always-appends `<AddZeroCmsEntry>` chip), divider, drop zone

**Type picker**:
The panel an Insert slot opens: a grid of the Field's Allowed types, each showing its
Thumbnail glyph, label and Type description. Picking one either opens a create form or,
when Entries of that Type already exist, offers reuse first. It pops itself as soon as
it resolves. Replaced the old behaviour of silently creating `allowedTypes[0]`.

Reached from **two** places, via `ReferenceActions.pickReference`: an Insert slot, and
the "+ Add…" on a Relation field inside an Edit drawer — which used to render one
"add new <Type>" button per Allowed type, i.e. 23 buttons for a page's `sections`.
_Avoid_: type selection drawer (the working name), pre-drawer, block library

**Standalone create** (`createEntry`):
Creating an Entry that belongs to no parent's Relation field — a Blog Post from the
Blogs index, where the content is queried by Type rather than held in a `references`
list, so there is no "+ Add" to inherit. Without it the only route is the Content admin.
_Avoid_: new entry (ambiguous), openCreate (that one links into a parent field)

**Thumbnail glyph** (`Type.thumbnail`):
A Type's wireframe preview in the Type picker, stored as a KEY into the consumer's
glyph registry (`TYPE_GLYPHS`) rather than a media id — a Type only becomes pickable
once a host ships a component for it, so the glyph ships alongside and can never
dangle. Unknown or absent keys fall back to a generic frame.
_Avoid_: icon, thumbnail image, preview image

**Type description** (`Type.description`):
A Type's one-line "what this block is for", shown under its label wherever a **Type**
is chosen rather than an Entry. Distinct from a Field's own `description`.
_Avoid_: help text, hint, label

**Remove vs Delete** (Section builder):
Two separate outcomes behind one trash button. **Remove** unlinks only — the Entry
survives and can be linked back. **Delete** unlinks and then deletes it, which
Reference integrity refuses while anything still points at it (commonly the parent's
own *published* version), so the unlink stays applied and the holders are named.
_Avoid_: delete (ambiguous on its own), archive, trash

**GraphQL layer**:
The opt-in `zero-cms-graphql` library. Generates a GraphQL schema (SDL + resolvers)
from the Schema and serves it through the same Adapter — an alternative to the generated
Store. Core stays GraphQL-agnostic; reference fields resolve via `populate` derived from
the selection set.
_Avoid_: gateway, API layer (ambiguous)

**User / Role / Session**:
A **User** lives in `users.json` (scrypt-hashed password, never exposed — the API
returns a `SafeUser`). **Role** is `admin` (types + users + content), `editor` (content
+ publish), or `viewer` (read drafts/preview only). A **Session** is a verified identity
from an HS256 token signed with `ZERO_CMS_AUTH_SECRET`.
_Avoid_: account, login (the act), JWT (implementation detail)

**Enforcement**:
Published GraphQL reads stay public; mutations and draft reads need an `editor`+ session;
the RPC surface is admin-only and role-gated per op; user management requires `admin`.
_Avoid_: guard (UI term), permission (use Role)

## Libraries

- **zero-cms-core** — the engine: config, load/save, Schema, Stores, codegen, watch.
- **zero-cms-app** — React UI to manage Types, Entries, and media. One `<ZeroCmsApp />`.
- **zero-cms-widget** — React drawer for in-place editing of one Entry by `__id`, plus
  the inspect-mode `<ZeroCmsEntry>` / `<ZeroCmsEntryField>` hover-to-edit wrappers.
- **zero-cms-graphql** — opt-in GraphQL schema + resolvers + Fetch handler over the Adapter.
- **zero-cms-blocks** — render (`<ZeroCmsBlocks>`) + edit (`<BlocksEditor>`) structured
  `blocks` rich text; replaces `@strapi/blocks-react-renderer`.
