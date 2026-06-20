# Upper Street Contractors

Language for renovation marketing content: services, projects, and trust signals on the public website.

## Language

**Project**:
A completed renovation case study shown as a card and on its own detail page.
_Avoid_: Job, portfolio item, case file

**Recent Work section**:
The home page section that lists curated Projects with a link to the full projects index.
_Avoid_: Portfolio section, gallery, work showcase

**Category tag**:
The gold uppercase badge overlaid on a Project card image showing the renovation type (e.g. Refurbishment, Bathroom).
_Avoid_: Label, pill, proj-tag (CSS class name only)

**Meta chip**:
A small badge below the image showing one project facet such as location, duration, or scope.
_Avoid_: Tag, chip, proj-chip (CSS class name only)

**Projects index**:
The `/projects` page listing all Projects with a category filter.
_Avoid_: Portfolio page, gallery, work listing

**Category filter**:
The client control on the Projects index that narrows the grid by Category tag text.
_Avoid_: Tab bar, filter pills (UI class names only)

**Badge**:
The reusable pill component that renders category tags and meta chips from variant, radius, href, and text props.
_Avoid_: Tag, chip, label

**Client Review section**:
The home page section that surfaces homeowner testimonials with star ratings and links to individual reviews on Trustpilot or Google.
_Avoid_: Testimonials section, reviews block, social proof

**Review card**:
A single testimonial tile showing a star score, quoted review text, and the reviewer's profile.
_Avoid_: Testimonial card, quote card, feedback tile

**Review profile**:
The reviewer identity on a Review card: avatar, name, review source, location, and link to the original review. Stored as `client-review-info` in Strapi.
_Avoid_: Author, user profile, client info (implementation name only)

## Inspect mode

**Inspect mode**:
The in-page editing overlay enabled by `?inspect=true` (or `NEXT_PUBLIC_STRAPI_INSPECTION_MODE`). Wrapped Entries and Fields show an edit pencil that opens the Edit drawer.
_Avoid_: Edit mode, preview mode, admin mode

**Preview mode** (`ENABLE_PREVIEW`):
Server env flag. `true` → every server GraphQL read requests `status: DRAFT`, so the whole site renders draft content; `false` → `PUBLISHED` only. Injected globally by `createPreviewLink` in `apollo-server.ts` (no per-call-site wiring). Distinct from Inspect mode (the editing overlay); preview can be on with the overlay off.
_Avoid_: Draft mode, inspect mode (a different concept)

**Entry**:
A single Strapi document instance wrapped by `StrapiEntry` (carries its `documentId` and GraphQL typename). Its edit pencil opens the Edit drawer showing all editable Fields, none focused.
_Avoid_: Record, item, node

**Field**:
One editable attribute of an Entry, wrapped by `StrapiEntryField`. Its edit pencil opens the same Entry's drawer with that Field focused (dashed glowing border).
_Avoid_: Property, column

**Edit drawer**:
The right-side panel in Inspect mode that renders a form for an Entry's Fields and saves changes to Strapi as drafts.
_Avoid_: Modal, sidebar, sheet, popover

**Supported field type**:
A Field the Edit drawer edits inline: text, richtext (Strapi blocks), number, boolean. Any other type shows a "not currently supported — open in CMS" message.
_Avoid_: Editable field (ambiguous)

**Publish all changes**:
The action (green bottom-center button) that publishes every Entry whose draft was changed in the current Inspect-mode session, draft → published.
_Avoid_: Save all, deploy, go live
