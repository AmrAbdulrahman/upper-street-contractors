# Upper Street Contractors

Language for renovation marketing content: services, projects, and trust signals on the public website.

## Language

**Project**:
A completed renovation case study shown as a card and on its own detail page. Stored as a `project` entry carrying a hero image, Category, Sub-category, Meta-chip facets, a description, What We Delivered, a Project Timeline, Client Comments, Project images and Similar Work. (The earlier card-only `project-card` type has been retired.)
_Avoid_: Job, portfolio item, case file

**Recent Work section**:
The home page section that lists curated Projects with a link to the full projects index.
_Avoid_: Portfolio section, gallery, work showcase

**Page Hero**:
The banner section at the top of an interior page (Refurbishments, Kitchens, Bathrooms, Projects, About), rendered from a `page-hero` CMS entry in the page's `sections`: a `Home / <label>` breadcrumb, a gold uppercase overline, a serif title, a subtitle, and an optional row of CTA buttons (a page with none simply omits them). Distinct from the Home hero (the `HomeHeaderSection` atop the home page, which carries the at-a-glance panel).
_Avoid_: page header, banner, ProjectsHeroPlaceholder (the removed UI-only mock)

**Enquiry Wizard**:
A stepped enquiry form section (`wizard` CMS type) on the Contact page, shown beside the Contact Details panel (its `contactDetails` relation). Each step is a Question — either an **Image Question** (image-card options, single or multi-select) or a **Form Question** (text/email/tel/textarea fields). A connected-dot **stepper** marks each step Complete / Current / Pending and lets you click back to a visited step; advancing is manual via a Next button. On finish it auto-opens (after ~5s) a WhatsApp message prefilled from the answers to the configured `whatsappNumber`.
_Avoid_: form, survey, quiz, multi-step form

**Contact Details panel**:
The `contact-details` section listing ways to reach the company as items (each a `contact-detail-item`: emoji, label, text), plus a note and a WhatsApp button.
_Avoid_: contact card, info box, get-in-touch

**Category tag**:
The gold uppercase badge overlaid on a Project card image showing the renovation type (e.g. Refurbishment, Bathroom).
_Avoid_: Label, pill, proj-tag (CSS class name only)

**Meta chip**:
A small badge below the image showing one project facet such as location, duration (derived from the begin/end dates), or project value.
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

**Sub-category**:
A finer classification under a Project's Category (e.g. "Rear dormer loft" under Loft, "Wetroom conversion" under Bathroom). Free text; not used by the Category filter.
_Avoid_: subtype, kind

**Duration**:
A Project's length — a Meta chip **derived** from its begin and end dates (e.g. "3 weeks", "4 months"), never stored.
_Avoid_: timePeriod (implementation phrasing), time frame

**Project value**:
The build value of a Project (e.g. "£120k"), shown as a Meta chip.
_Avoid_: price, cost, budget

**What We Delivered**:
The Project-detail section pairing a short intro (`deliveredSummary`) with a grid of Deliverables.
_Avoid_: scope of works, services

**Deliverable**:
One item in What We Delivered — a title and a short description of a distinct piece of work.
_Avoid_: task, feature, line item

**Client Comment**:
A homeowner quote attached to a single Project (a name and a comment), shown on that Project's detail page. Distinct from a Review card, which is site-wide social proof carrying a star score.
_Avoid_: testimonial, review (the site-wide concept)

**Project Timeline**:
The ordered list of Timeline Steps on a Project's detail page describing how the job progressed.
_Avoid_: schedule, roadmap, programme

**Timeline Step**:
One stage in a Project Timeline — an optional step marker, a title, and a description.
_Avoid_: milestone, phase

**Project images**:
The photos on a Project's detail page (each an image with an optional caption), rendered as a grid headed "Photos".
_Avoid_: gallery (an _Avoid_ term for Recent Work / Projects index), carousel, slider

**Similar Work**:
The related-Projects strip on a Project's detail page. Editor-pinned Projects (the `similarWork` relation) come first, then the closest others are filled in automatically, ranked by Category → Location → Duration.
_Avoid_: related posts, you-might-also-like, recommendations

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

## Relations

**Relation field**:
An Entry field that points at other Entries. Its cardinality is either One-to-One or One-to-Many, chosen in the type-builder.
_Avoid_: reference / references (the implementation `__type` names), foreign key, link field

**One-to-One relation**:
A Relation field holding at most one target Entry (implementation `__type: reference`).
_Avoid_: single ref

**One-to-Many relation**:
A Relation field holding an ordered list of target Entries (implementation `__type: references`); its length may be bounded by optional min / max.
_Avoid_: multi ref, collection

**Allowed types**:
The set of Types a Relation field may point at.
_Avoid_: whitelist, ref types

**Reference list**:
The Inspect-mode wrapper that renders a One-to-Many relation as an add-able row/grid of cards, injecting a "+ Add" affordance and enforcing `max` (component: `ZeroCmsList`). Removal is not offered here — a child is removed from the parent's Edit drawer.
_Avoid_: repeater, collection list

**Stacked drawer**:
Edit drawers layered on top of one another. Opening a linked child Entry (to edit) or creating a new one from within a drawer pushes a new panel; closing it returns to the panel beneath, with its state intact. New Entries are linked into the parent only when their create form is saved.
_Avoid_: nested modal, sub-drawer

**Link-on-save**:
A newly created related Entry is linked into its parent only once the new Entry's own form is saved; cancelling creates no orphan. Applies wherever a Relation field is edited — Inspect mode and the Content admin alike.
_Avoid_: Deferred link, optimistic create

## Editor access

**Editor**:
A Strapi Users & Permissions user (Editor role) who logs into the website to edit content in Inspect mode, using their own token.
_Avoid_: Admin user (the Strapi `/admin` panel account — a separate account system the website does not use)

**Editor session**:
The logged-in state of an Editor, carried by the access + refresh tokens stored as httpOnly cookies on the website domain.
_Avoid_: Login, auth state

**Read-only service token**:
The server-side-only Strapi token used to render published content for anonymous visitors (production) and builds. Never reaches the browser; distinct from an Editor's token.
_Avoid_: Public API, anon key, API key

## Dev tooling

**CMS Call Meter**:
The local-dev-only pill showing how many times the site has hit the Strapi CMS this session. Lives at the left of the Preview admin bar, and on the Login gate + cold-start screens so it stays visible in every gate state. Renders only on `next dev` (gated on `NODE_ENV` at each mount site), never on any deployed env — including staging, where the Preview admin bar itself still shows. Clicking it opens the CMS Call panel.
_Avoid_: Badge (a different, content concept), counter, widget

**CMS Call panel**:
The window the CMS Call Meter opens. Two tabs: Analytics (which parts use the CMS most, request totals, real-HTTP-vs-cached split, durations) and Details (the live, grouped, paginated call log for the session). Fed by polling the dev-only `/api/dev/cms-calls` route.
_Avoid_: Modal, dialog, drawer, inspector

**Real HTTP vs cached call**:
A recorded CMS call is _real HTTP_ when it actually reached Strapi, or _cached_ when Next `unstable_cache` served it without a network hit. The CMS Call panel can filter by either.
_Avoid_: Hit/miss (ambiguous), live call
