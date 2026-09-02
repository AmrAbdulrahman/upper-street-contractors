# Upper Street Contractors

Language for renovation marketing content: services, projects, and trust signals on the public website.

## Language

**Project**:
A completed renovation case study shown as a card and on its own detail page. Stored as a `project` entry carrying **identity** — hero image, Category, Sub-category, Meta-chip facets, a summary and description, Similar Work — plus a `sections` list holding its content, exactly the way a page and a Blog Post are composed (ADR 0022). What We Delivered, the Project Timeline, its photos and its client quotes were four owned child lists on the entry until then; they are sections now, so they can be reordered, dropped, and carried by a Template. (The earlier card-only `project-card` type has been retired.)
_Avoid_: Job, portfolio item, case file, page (a Project is composed like one but is not a `page`)

**Recent Work section**:
The home page section that lists curated Projects with a link to the full projects index.
_Avoid_: Portfolio section, gallery, work showcase

**Page Hero**:
The banner section at the top of an interior page (Refurbishments, Kitchens, Bathrooms, Projects, About), rendered from a `page-hero` CMS entry in the page's `sections`: a `Home / <label>` breadcrumb, a gold uppercase overline, a serif title, a subtitle, and an optional row of CTA buttons (a page with none simply omits them). Distinct from the Home hero (the `HomeHeaderSection` atop the home page, which carries the at-a-glance panel).
_Avoid_: page header, banner, ProjectsHeroPlaceholder (the removed UI-only mock)

**Enquiry Wizard**:
A stepped enquiry form section (`wizard` CMS type) on the Contact page, shown beside the Contact Details panel (its `contactDetails` relation). Each step is a Question — either an **Image Question** (image-card options, single or multi-select; an option may reveal a free-text box via `revealTextInput`) or a **Form Question** (text / email / tel / textarea / boolean-toggle / date / Availability / file fields, any of which may be a Conditional field). A connected-dot **stepper** marks each step Complete / Current / Pending and lets you click back to a visited step; advancing is manual via a Next button. On finish it POSTs the answers (plus any attachments) to `/api/enquiry`, which sends the Enquiry email to the business and the Confirmation email to the sender, then shows a done panel. (Superseded the earlier WhatsApp-prefill handoff.)
_Avoid_: form, survey, quiz, multi-step form

**Step introduction**:
The rich-text passage beneath a wizard step's inputs, explaining the choice being asked for. A **reference** to a Rich Text Block (`intro`), not inline blocks — so it is an entry with its own pencil, editable on its own and reusable across steps. It sits **below** the inputs: above them it pushed the thing being asked about off a phone's first screen, and the copy is context for a choice already on screen. A Question's own `intro` is used unless a variant's Branch rule matches, exactly as its title is.
_Avoid_: body (the retired inline field, and the Rich Text Block's own field name), hint (the one-line grey note under the heading), step copy (the variant mechanism)

**Rich Text Block**:
A passage of rich text held as its own entry (`rich-text-block`: a single blocks `body`). Introduced so a Step introduction could stop being a field buried in a step's drawer. Not a page section — it has no overline, no width and no place in `page.sections`; a Prose Section is the full-width page-level counterpart.
_Avoid_: Prose Section (the page section), rich text (the field kind / RichTextViewer), text block

**Conditional field**:
A Form Question field (or an Image Question free-text box) that is only shown when another answer matches. A `form-field` carries `dependsOnFieldKey` + `dependsOnValue` (e.g. Company Name appears only when the "I am a company" toggle is on); an `image-option` with `revealTextInput` shows a describe-more textarea when that option is selected. Hidden fields never block Next.
_Avoid_: dependent field, show/hide rule, branching

**Attachment**:
A file a visitor adds on the wizard's final step (`file` field type). Any file type; validated on both sides against three caps (≤10 files, ≤50 MB each, ≤200 MB total). Picks accumulate rather than replace, so a visitor can add more on a later click. Each one reaches the business as either an Inline attachment or a Hosted attachment.
_Avoid_: upload, file field (implementation phrasing)

**Inline attachment**:
An Attachment small enough to ride the enquiry email as a real attachment. Filled greedily in the visitor's own order up to a fixed budget, because the request that carries them to `/api/enquiry` is itself size-capped.
_Avoid_: small file, embedded file

**Hosted attachment**:
An Attachment that did not fit the Inline attachment budget. The browser uploads it directly to blob storage and both emails carry a download link instead of the bytes — the only way a phone video reaches the business at all.
_Avoid_: link, blob, big file

**Enquiry email**:
The copy of a wizard submission the business receives — subject *Online Enquiry*, plus the sender's name when one was given, and the sender's own address as the reply-to, so hitting reply answers the visitor. Its body is the answers as a labelled table, any Inline attachment riding along and any Hosted attachment as a download link.
_Avoid_: notification, enquiry notification, Confirmation email (the sender's copy)

**Confirmation email**:
The copy of the same submission sent back to the visitor — subject *Confirmation of Your Enquiry - Upper Street Contractors* — opening on an acknowledgement that a member of the team will review the details and reply, then the same table under a line saying it is a copy of what they sent. Best-effort: a bounce here never fails the submission, since the business already has the enquiry.
_Avoid_: receipt, auto-reply, thank-you email, Enquiry email (the business's copy)

**Email trust row**:
The band of accreditation and review marks at the foot of both emails, between the details and the copyright line: the Footer accreditation row's three badges on one line, then Trustpilot and Google on a second — five marks abreast overflow a phone's mail view. FMB, Trustpilot and Google are links (a membership profile and the two review destinations); Gas Safe and NIC EIC are plain images, there being no per-badge URL to point at. A **frozen copy**, not a live read: the marks are committed image files, so an enquiry send never depends on the CMS or the Blob store being up — and swapping a badge in the footer does not reach the emails.
_Avoid_: email footer (the copyright line), Footer accreditation row (the site-wide one it copies), Accreditations section (the page section), trust bar, Badge glow (a footer-only treatment)

**Availability** (Form Question field):
An `availability` field: a multi-date calendar, and beneath it one "Preferred time of day (date)" row per Preferred date, each offering the same three Time windows as multi-select chips. So a visitor free Monday morning and Thursday evening can say exactly that. Paired on the Contact wizard with an Emergency boolean-toggle, replacing the start-date + standalone Time window pair. An editor tunes the calendar from the **Timing step**'s drawer rather than the field's: max dates, earliest date, horizon in months, allow Saturdays, and the emergency window — each `0` meaning no limit. Required means ≥1 Preferred date **and** ≥1 Time window across them; an empty calendar is not an answer.
_Avoid_: availability calendar, date range, booking, time picker, timeslot

**Preferred date**:
One day a visitor ticked in an Availability field. Holds zero or more Time windows; none ticked is a real answer meaning "Any time" that day, which the field says on the row. Rows always read chronologically, whatever order the days were clicked.
_Avoid_: start date, visit date, slot, appointment

**Time window**:
One of three fixed slots — 9am–1pm, 1pm–4pm, 4pm–8pm — tickable on a Preferred date. (The retired standalone `timeWindow` field, which offered the same slots attached to no particular day, still exists for an editor to place; the stored enum value is camelCase because a hyphen would collapse the lookup to a plain String.)
_Avoid_: time picker, slot, availability (the field that contains them), timeslot

**Timing step**:
The Enquiry Wizard step holding the Emergency toggle and the Availability calendar, and the entry that carries the calendar's settings — max dates, earliest date, horizon in months, allow Saturdays, and the emergency window in days. They belong to the step because the two fields beneath it are two halves of one question and the settings answer to neither alone: while they sat on the field, `form-field` being a single Type shared by every input put five calendar controls in all ~15 field drawers, and the emergency window ended up written to both the toggle and the calendar with only the calendar's copy ever read. Its title is variant-driven, so anything looking for it must go by the Availability field it contains, never by its label.
_Avoid_: timing question, booking step, appointment step, slot picker, Availability (the field it configures)

**Contact Details panel**:
The `contact-details` section listing ways to reach the company as items (each a `contact-detail-item`: emoji, label, text), plus a note and a WhatsApp button.
_Avoid_: contact card, info box, get-in-touch

**Quick Contact widget**:
The pair of floating tabs pinned to the top-right of every public page (rendered by `QuickContact` in `SiteChrome`): a WhatsApp tab and a Request-a-Quote tab. Each shows only its icon at rest and stretches left to reveal its label on hover/focus (CSS-only). Superseded the desktop header's Request-a-Quote + WhatsApp buttons (removed); the mobile menu still carries its own.
_Avoid_: floating buttons, contact FAB, sticky CTA

**Category tag**:
The gold uppercase badge overlaid on a Project card image showing its Category — a renovation type (Refurbishment, Kitchen, Bathroom, Loft) or a trade (Plumbing, Heating, Electrical, Carpentry, Roofing, Handyman). The Category also drives which Projects a Case Studies section shows.
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
The section pairing a short intro with a numbered list of Deliverables — a completed Project's past-tense scope (a `project-scope-section`, offered only on a Project). Distinct from a Service page's present-tense Service Offer section, which it deliberately resembles.
_Avoid_: scope of works, services, Service Offer section (the present-tense one), `deliveredSummary` (the retired Project field its intro came from)

**Deliverable**:
One item in What We Delivered — a title and a short description of a distinct piece of work.
_Avoid_: task, feature, line item

**Client Comment** (retired):
A homeowner quote attached to a single Project, held as its own `client-comment` entry. A Project's quotes are Quote sections now — the same two things (a line of copy and who said it) as a block an editor can place, reorder and see. The Type still exists and its entries are still stored; nothing reads them.
_Avoid_: testimonial, review (the site-wide concept), Quote section (what replaced it)

**Project Timeline**:
The section listing ordered Timeline Steps describing how a job progressed (a `project-timeline-section`, offered only on a Project).
_Avoid_: schedule, roadmap, programme, How It Works section (the home page's, about the company)

**Timeline Step**:
One stage in a Project Timeline — an optional step marker, a title, and a description.
_Avoid_: milestone, phase

**Project images** (retired):
The photos on a Project's detail page, held as `project-image` entries. A Project's photos are a Gallery section of Figures now: a Figure and a Project image were the same two fields (image + caption), and the only thing separating them was which page they hung off. The hero collage they also fed is one `hero` photo instead. The Type still exists and its entries are still stored; nothing reads them.
_Avoid_: gallery (an _Avoid_ term for Recent Work / Projects index), carousel, slider, Figure (what replaced it)

**Similar Work**:
The related-Projects strip on a Project's detail page. Editor-pinned Projects (the `similarWork` relation) come first, then the closest others are filled in automatically, ranked by Category → Location → Duration. The same card grid is reused by a Service page's Case Studies section.
_Avoid_: related posts, you-might-also-like, recommendations

**Client Review section**:
The home page section that surfaces homeowner testimonials with star ratings and links to individual reviews on Trustpilot or Google.
_Avoid_: Testimonials section, reviews block, social proof

**Clients Carousel**:
A page section (`clients-carousel` CMS type) showing an editor-chosen list of client logos (`client-logo` children: image + optional name + link) in an infinitely rotating, pause-on-hover strip on desktop (≥1024px); collapses to a static 3-column grid (5px gaps all around) on tablets, to **one logo per row** below 640px, and to a static wrapped row under `prefers-reduced-motion`. Logos are full colour at every width with no hover state at all — a mark a visitor has to hover to see properly is one most visitors never see, and a touch screen has no hover to give. Carries a Logo height. (That rule is about **this strip**: it rejects hover as a way of *revealing* a logo, not motion as such. The Footer accreditation row lifts on hover and hides nothing.)
_Avoid_: logo slider, partners marquee, brand ticker

**Accreditations section**:
The trust-badge strip (`accreditation-list` CMS type) sitting under the hero — the Trustpilot widget on the same row as an editor-chosen list of accreditation badges (`accreditation` children: image + title). One row on desktop, wrapping when it no longer fits. Carries a Logo height, which sizes the badges only. A page section, placed per page; distinct from the Footer accreditation row, which is site-wide Settings content holding its **own** badge entries.
_Avoid_: certifications, credentials, badges row, trust bar, Footer accreditation row

**Footer accreditation row**:
The full-width trust band at the foot of every page: the Trustpilot widget, then accreditation badges, between the footer's columns and its legal bar. Its badges are `accreditation` entries held by Global Settings (`footerAccreditations`) with their own Logo height — **copies** of the Accreditations section's, not the same entries, so a footer edit cannot restyle the home page. No white tiles here: on a navy footer a white card is a rectangle punched into the page rather than a badge sitting on it, so each mark carries a Badge glow instead. Badges are full colour at rest and lift on hover; the Trustpilot widget gets neither the glow nor the hover (a vendor iframe has no element of ours to transform) and is rendered in its **dark** theme, without which its near-black type is invisible on navy while its stars still show. Replaced three hardcoded text labels that had already drifted from the real accreditations.
_Avoid_: Accreditations section (the home-page one), footer badges, trust bar, FOOTER_ACCREDITATIONS (the retired static list)

**Badge glow**:
The neon halo around a badge in the Footer accreditation row. Three settings, each set **per badge** with a Global Settings fallback: a colour (`accreditation.glowColor`), a Glow size and a Glow strength. Per badge because each is a different organisation's mark with its own palette and its own weight — one site-wide gold behind Gas Safe's yellow and NICEIC's red fought both, and a solid block needs less bloom than a thin outline. Global Settings' `footerGlowColor` / `footerGlowRadius` / `footerGlowIntensity` are the fallbacks, value by value, so a newly added badge still glows. Drawn with `drop-shadow`, which follows the image's alpha channel and so traces the logo's own silhouette rather than boxing it — the reason it is not a `box-shadow`.
_Avoid_: shadow, halo, neon, outline, Logo height (the sizing setting)

**Glow size**:
How far a Badge glow spreads, in pixels. `0` is a real off switch — no filter is drawn at all, rather than a hard-edged copy of the logo behind itself. The tight inner shadow scales with it, so the pair stays in proportion at any size.
_Avoid_: radius, blur, glow (the halo itself), Glow strength

**Glow strength**:
How much of a Badge glow's colour survives, 0–100. Separate from Glow size because they answer different questions: size is how far the light travels, strength is how much of it there is — and shrinking a glow to soften it also detaches it from the logo, which is the opposite of what the glow is for on a navy footer. Applied by mixing the colour toward transparent, so the badge keeps its own hue.
_Avoid_: opacity, alpha, intensity (the field name), Glow size

**Logo height**:
The pixel number an editor sets to size every logo on a strip — the Accreditations section (`logoSize`), the Clients Carousel (`logoSize`) and the Footer accreditation row (`footerLogoSize`, on Global Settings) each have their own. It is a height; each logo's width follows its own aspect ratio, which is what keeps a row of mixed-shape logos looking even. It does **not** apply to the Trustpilot widget, which is a vendor embed at a font size we cannot set.
_Avoid_: logo size, image width, scale, zoom

**Site Banner**:
The SVG brand mark rendered by `SiteBanner` — **one** image, the crest and the "Upper Street Contractors" wordmark as a single 732×287 lockup (`banner-*.svg`), sized by a height. Ships in two tones: navy for light backgrounds (header, `tone="dark"`) and white for dark (footer, `tone="light"`), each overridable in Global Settings by one asset field. It was split into a crest and a cropped wordmark so the header could shrink the crest on scroll while the words held their size; the header has not shrunk since the Services menu replaced the row of nine service links, so the split was paying for a behaviour nothing used — two requests, two sizing props and a gap between the halves tuned to imitate the artwork they came from. The crest-only files remain, but only as the favicon and email assets, not as a variant of this.
_Avoid_: logo (the old text wordmark), crest / wordmark (the retired halves and their four settings slots), SiteLogo (the retired component), service-links row (the retired second header row)

**Service page**:
A per-service landing page — Refurbishments, Kitchens, Bathrooms, Plumbing, Heating, Electric, Carpentry, Roofing, Handyman, and any an editor adds. Reached from the Services menu and the Services index (they were the header row itself until the menu took over). Each is a CMS `page` whose `sections` follow one shared shape: a Page Hero, a Service Offer section, a Case Studies section, and a per-page CTA band (a `planning-renovation-section` carrying WhatsApp + Request-a-Quote). Served by **one dynamic route** resolving a page by its Slug; it was nine near-identical route files whose only difference was two constants, which made a Service the one kind of content nobody could create without a deploy (ADR 0020). The `<service>-service` `key` survives as an internal handle, but the URL comes from the Slug. Distinct from the Projects / About / Contact pages, which keep their own route files, and from the Services index that lists them.
_Avoid_: category page, landing page (generic), key (the internal handle, not the URL), service-links row (the retired header row)

**Services index**:
The `/services` page listing all nine Service pages as cards. A CMS `page` (key `services`) like any Service page — a Page Hero, a Service grid section and a CTA band — not a bespoke route with a hardcoded grid. It is the hub the Services menu's own label and the footer's Services link both point at, and since the footer stopped listing the nine trades it is the one page that links every Service page. No category filter: nine distinct items have nothing to narrow.
_Avoid_: services page (ambiguous with a Service page), our services, category index, Projects index (the analogous page for Projects)

**Service grid section**:
A page section (`service-grid-section`) pairing a gold overline and a title with a grid of Service cards. Mirrors the Projects index's grid proportions and hover so the two read as one site. Powers the Services index, and can be placed on any page.
_Avoid_: services list, What We Do (the home-page section, which is Work Cards + a banner), card grid

**Service card**:
One service in a Service grid (a `service-card`: image, title, summary, and a **relation to its Service page**). Its photo is a real Project hero for that Category, so a Kitchens card shows a kitchen. Its link is derived from the linked page's Slug, never typed: while it carried a free-text path, the card and the page it meant were two strings an editor could change independently, and a typo in one silently produced a card linking to a 404. Distinct from a Work Card, which is a home-page What We Do tile carrying an emoji and a price line rather than a photo.
_Avoid_: Work Card, service tile, Project card, href (the retired free-text path field)

**Services menu**:
The header's `Services` item: a real link to the Services index **plus** a chevron button that opens a dropdown of the nine Service pages. Two controls, not one — making the whole item the toggle would put the Services index out of reach, and opening on hover alone would hide the menu from every touch visitor, since a tap navigates rather than hovers. Its items are read from the Services index's own card grid rather than a hardcoded list, so the menu and `/services` cannot disagree about what we do and a newly created Service appears in both; with no cards it is a plain link and no dropdown at all. Opens on hover for a mouse and on the chevron for everyone else (click, Enter, Space); Escape closes it and returns focus to the chevron, and tabbing out of the panel closes it behind you. A pointer leaving the group closes it after a short grace period, not immediately, and the panel's offset from the label is its own padding rather than a margin: the panel is out of flow, so a margin left a band of pixels belonging to neither control, and crossing it closed the menu before the pointer could arrive — which made every link in it unreachable by mouse. It deliberately does **not** open merely on focus: closing returns focus to the chevron, which sits inside the group, so a focus-to-open rule reopened the panel a frame after Escape and made Escape look broken. In the mobile menu it is a native `<details>` group with an "All services" row beneath it.
_Avoid_: services dropdown, mega menu, service-links row (what it replaced), flyout

**Service Offer section**:
The Service-page section stating what we deliver for that service — a `service-offer-section` with an overline, title, intro, a numbered scope list of Deliverables and an optional callout, beside an aside of one or more Cost cards. Present tense (the offer), distinct from a Project's past-tense What We Delivered.
_Avoid_: scope of works, services, What We Do (the home-page section)

**Cost card**:
A card in a Service Offer section's aside showing a price or range with a CTA. Stored as a `cta` entry rendered in its `sidebar` variant (title, cost, subtitle, buttons); a section may hold any number.
_Avoid_: pricing table, quote box

**Case Studies section**:
The Service-page strip of Projects whose Category matches the page's service (most recent first, capped at three), reusing the Similar Work card grid with its own headings. A `case-studies-section` carries an overline, title and a Category; the Projects are looked up automatically, not pinned. Distinct from Similar Work (project-detail, ranked) and the Recent Work section (home, curated).
_Avoid_: related projects, portfolio, gallery

**Split Section**:
A page section (`split-section` CMS type) pairing a gold overline — spanning the full width, on top — with a body and an image sitting side by side beneath it. `imagePosition` (`start` | `end`) chooses which side the image takes on desktop, the body always taking the opposite side; the columns stack to one on mobile. The body is rich content (blocks), like the Who We Are section's. Rendered by `SplitSection`. Two are seeded as examples immediately before the Case Studies section on every service page in the nav.
_Avoid_: hero, banner, feature row, Who We Are section (a distinct home-page section)

**Prose Section**:
A full-width page section (`prose-section` CMS type) pairing a gold overline with a rich-text `body` (blocks) in a narrow reading column — no image. Rendered by `ProseSection` via `<RichTextViewer variant="prose">`, whose heading scale is the largest of them — every variant sizes headings by level now, but this is the one meant for long-form copy. Powers the Legal pages and any other prose page.
_Avoid_: Split Section (pairs the body with an image), Who We Are section (home-page; has title/image/buttons), rich text (the field kind / RichTextViewer component)

**FAQ section**:
A page section (`faq` CMS type) pairing a gold overline and a serif title with a One-to-Many relation to FAQ items, rendered as a single-open accordion (native `<details>`, one row open at a time). Seeded on the About page (5 items, at the page foot) and as a 3-item, service-specific block directly above the Case Studies section on every nav service page.
_Avoid_: accordion (the UI pattern only), questions section, help section, references (the implementation relation name)

**FAQ item**:
One question-and-answer pair inside a FAQ section (a `faq-item`: a `question` and a rich `answer`), shown as one collapsible accordion row.
_Avoid_: Q&A, question, accordion item (UI phrasing)

**Legal pages**:
The Privacy Policy (`/privacy-policy`) and Terms & Conditions (`/terms-and-conditions`) pages — each a CMS `page` (key matching the path) whose `sections` are a Page Hero + a Prose Section, linked from the footer's bottom legal bar beside the Cookie preferences link. Privacy copy is grounded in the site's real data flows (Enquiry Wizard emails, Consent cookies, Trustpilot / Google embeds).
_Avoid_: policy page, legal, T&Cs (informal), terms page

**Blog Post**:
One article on the Blog index, stored as a `blog-post` entry: a title, Slug, Excerpt, hero image, Author, publish date, a Blog category, and a `sections` list built with the Section builder from the same block Types a page uses. Its header (title / category / date / Author / hero) renders from the post's **own** fields, not from a section — so the index card and the page can never disagree, and the header cannot be dragged away or deleted. It carries no metadata field: its title and Excerpt **are** its metadata.
_Avoid_: article, news item, page (the CMS `page` Type it deliberately is not)

**Slug**:
The lowercase hyphenated words that make a URL, validated against that shape on every write rather than merely suggested. On a Blog Post it makes `/blog/<slug>` and is **derived, then detached**: while blank it mirrors the slugified title, and the first time an editor types in it (or the post already has one) it stops following the title for good — so a headline can be reworded without moving a URL that has already been shared. On a `page` it makes `/<slug>` and is **not** derived from anything: only Service pages carry one, and mirroring the title would mint a URL for every page in the CMS. zero-cms enforces no uniqueness in either case, so a duplicate silently shadows the earlier entry — the route takes the first match.
_Avoid_: permalink, path, key (a page's internal handle, not its URL), id (the uuid `/projects/:id` still uses)

**Author** (Blog Post field):
Who wrote a post — the display **name** of the CMS user picked from a dropdown of the current accounts, stored as text. Not a link to that account and not its own content type: accounts live outside the entry store, so a live link would mean exposing them publicly just to print a byline. The trade is that renaming a CMS user leaves older posts crediting the old name (ADR 0016).
_Avoid_: author entry (the retired `author` Type a Blog Post no longer points at — `project.author` still declares it), byline, CMS user (the account, not the credit)

**Excerpt**:
A Blog Post's short standfirst — the copy on its index card (clamped to three lines there so a row of cards stays even), under its title on the post itself, and its meta description. Plain text, so it stays legible in a card, a `<meta>` tag and a search result alike. The **only** source of a post's description: there is nothing to pick instead.
_Avoid_: summary (the Project field), description, intro, teaser

**Blog index**:
The `/blog` page: a Page Hero from its `blogs` `page` entry, then every published Blog Post as a card, newest first, with a text search, a Blog category chip row and a numbered pager. Every post ships in the HTML and all three controls filter client-side, so a search covers the whole archive rather than one page; discovery does not depend on the pager, since every `/blog/<slug>` is in the sitemap. (`/blogs/*` still resolves, as a permanent redirect.)
_Avoid_: Blogs index (the earlier plural name, and the plural URL), blog page, archive, feed, Projects index (the analogous page for Projects)

**Blog category**:
The single topic a Blog Post is filed under (Kitchens, Bathrooms, Guides, News, …), shown as a gold badge on its card and — beneath the title — on its header, and driving the Blog index chip row. One per post; there is no tag concept, deliberately — a second overlapping taxonomy is the thing editors get wrong.
_Avoid_: tag, topic, Category tag (the Project concept, a different option set)

**Blog card**:
One Blog Post on the Blog index: hero image with its Blog category badge, publish date, title and Excerpt. Mirrors the Project card's proportions and hover so the two grids read as one site.
_Avoid_: post tile, article card, Project card

**Duplicate**:
The action that copies one specific Blog Post, Project or Service page to start a new one from. Reached from that thing's card on its index (the hover cluster, beside the pencil) or from the Entry actions row on the thing's own page. **Deep**: the copy takes its own sections and their children, because a post's content *is* its `sections` and sharing them would let an edit to the copy rewrite the original. Three things are not copied — media (an `asset` is a media id; both point at the same file), standalone content (a Project has its own URL, a Button is shared site-wide), and lifecycle (a copy is an unpublished draft). Its title gains " (copy)" and its Slug is cleared so it re-derives (ADR 0017). Distinct from a Template: this copies *one post you can point at*, keeping its title and every field; a Template is a named, reusable shape that carries no identity at all.
_Avoid_: clone, copy, Template (a real feature now, and a different one), reuse (the Type picker's sharing step, which is the opposite)

**Template**:
A named, reusable starting shape for a new Blog Post, Service page or Project (a `template` entry: a name, a Template kind, and `sections`). Choosing one on a card index deep-copies its children onto a brand new entry, so the new thing is independent of the template from the first keystroke — the opposite of the Type picker's reuse step, which shares one entry between two places on purpose. It carries no identity of its own to hand on: no title, no Slug, no hero. Authored only by **Save as template** on real content, because the Section builder — the one tool that composes a section list visually — exists on a rendered page, and a Template has none (ADR 0019).
_Avoid_: page template (a Project is not a page, and a Blog Post deliberately is not either), boilerplate, preset, Duplicate (the one-off copy of a single post)

**Template kind**:
Which Type a Template creates — `blog`, `service` or `project` — and therefore what the picker on each index offers. All three lay down the same thing, a `sections` list: the project kind used to be the exception, carrying four owned child lists because a Project had no sections, and it lost them when a Project became a list of sections like everything else (ADR 0022).
_Avoid_: category (**Category tag** and **Blog category** are both taken), type, target, slot (there is one list now, not four)

**Save as template**:
The action — on a card's hover cluster beside the pencil and Duplicate, or in the Entry actions row on the thing's own page — that snapshots real content into a new Template and opens it so the editor can name it. On the Services index it snapshots the **page the card links to**, not the card, since a Service card has no sections of its own.
_Avoid_: save as preset, make template, Duplicate

**Entry actions row**:
The Publish / Unpublish / Duplicate / Save as template / Delete row at the top of a Blog Post, a Project or a Service page while edit mode is on, acting on the entry that page IS. These three are queried by Type rather than held in a parent's relation field, so they inherit none of the Section builder's affordances: without the row, publishing or deleting the thing you are looking at means leaving for the Content admin. Delete confirms in place and names what it is about to delete. On a Service page, Duplicate also mints the `service-card` that reaches the copy — a Service is two entries, and a page with no card is unreachable.
_Avoid_: toolbar, action bar, zero-cms bar (the floating editing bar, a different thing)

**Card flash**:
The brief gold ring on a card an editor has just created, shown once the Edit drawer closes rather than the moment the entry exists — fired while the drawer is still open, it would play out entirely behind the panel. Answers "where did it go?": newest-first puts a new post at the top, but a new Service card lands wherever the grid's order says, and on a filtered view it may be off screen. Under `prefers-reduced-motion` the ring is held instead of pulsing.
_Avoid_: highlight, pulse, toast (the corner notification, a different thing)

**Image section**:
A page section (`image-section`) holding one photo and an optional caption, at a chosen Width (narrow / wide / full) — `narrow` matching a Prose Section's reading column so an image between two text blocks lines up with them.
_Avoid_: photo, banner, Gallery section (the multi-photo one)

**Gallery section**:
A page section (`gallery-section`) showing a grid of Figures at 2–4 Columns, with an optional title. The multi-photo counterpart to the Image section.
_Avoid_: carousel, slider, Project images (the retired Type it replaced on a Project), gallery (an _Avoid_ term elsewhere)

**Figure**:
One captioned photo inside a Gallery section (a `figure`: image + caption). Every photo on the site that carries a caption is one, a Project's included — the Project image it used to compete with is retired.
_Avoid_: photo, image, Project image (the retired Type)

**Quote section**:
A page section (`quote-section`) pairing one emphasised line of copy with an optional attribution, marked up as a real `<blockquote>`/`<cite>`. What a homeowner said about one Project is one of these too, since the retired Client Comment said nothing more. Distinct from a Review card (site-wide, carries a star score, links to its source).
_Avoid_: pull quote (fine in prose, but this is the Type), testimonial, Client Comment (the retired Type)

**Separator**:
A page section (`separator-section`) putting a break between blocks, as a rule, dots, or plain space. The `space` variant renders no `<hr>` — a horizontal rule announces a *thematic* break to a screen reader, and breathing room is not one.
_Avoid_: divider, spacer, hr

**Review card**:
A single testimonial tile showing a star score, quoted review text, and the reviewer's profile.
_Avoid_: Testimonial card, quote card, feedback tile

**Review profile**:
The reviewer identity on a Review card: avatar, name, review source, location, and link to the original review. Stored as `client-review-info` in Strapi.
_Avoid_: Author, user profile, client info (implementation name only)

## Inspect mode

**Inspect mode**:
The in-page editing overlay, available while previewing under `/admin/*` and toggled by the zero-cms bar's edit-mode button. Wrapped Entries and Fields show an edit pencil that opens the Edit drawer. The flag is **client state**, and `?inspect=true` mirrors it — the parameter is what makes an edit-mode URL shareable and reloadable, not what drives the overlay; no server component reads it. Remembered per browser, so an editor who closes the tab comes back editing, and shared across tabs, which is why one tab toggling it flips the others.
_Avoid_: Edit mode, preview mode, admin mode, `NEXT_PUBLIC_STRAPI_INSPECTION_MODE` (retired Strapi-era flag)

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
The Inspect-mode wrapper that renders a One-to-Many relation as an add-able row/grid of cards, injecting a "+ Add" affordance that **appends**, and enforcing `max` (component: `ZeroCmsList`). Removal is not offered here — a child is removed from the parent's Edit drawer. Now used only for card-grid children (a Gallery section's photos, accreditation badges); a page's `sections` uses the **Section builder** instead, which does offer removal, insertion at a chosen position and reordering.
_Avoid_: repeater, collection list, Section builder (the richer editor for `sections`)

**Section builder**:
The Inspect-mode editor for a page's or Blog Post's `sections` — the one place the **set** of sections on a page can change rather than just their contents. An Insert slot sits before the first section, between every pair and after the last; each section's hover cluster gains a trash button beside its pencil; a drag handle reorders, with every section collapsing to a compact card while dragging so a screen-tall hero is still movable — and the page **does not move under the pointer** while that happens. Live on every CMS-driven page (`<PageSections>`); before it existed, sections could be edited but never added, removed or reordered anywhere on the site. Defined in the zero-cms context — see `libs/zero-cms-core/CONTEXT.md`.
_Avoid_: page builder, block editor, Reference list (the simpler card-grid wrapper)

**Stacked drawer**:
Edit drawers layered on top of one another. Opening a linked child Entry (to edit) or creating a new one from within a drawer pushes a new panel; closing it returns to the panel beneath, with its state intact. New Entries are linked into the parent only when their create form is saved. A **Drawer breadcrumb** at the top of each panel names the whole stack and jumps back to any panel in it, rather than one Escape per level — defined in the zero-cms context, see `libs/zero-cms-core/CONTEXT.md`.
_Avoid_: nested modal, sub-drawer

**Link-on-save**:
A newly created related Entry is linked into its parent only once the new Entry's own form is saved; cancelling creates no orphan. Applies wherever a Relation field is edited — Inspect mode and the Content admin alike.
_Avoid_: Deferred link, optimistic create

## CMS access

**CMS user**:
An account in the CMS that signs into the Content admin and Inspect mode. Carries exactly one Role; created and managed by an Admin from the Users tab.
_Avoid_: Editor (the retired Strapi term — name the Role instead), admin panel account, Strapi user

**Role**:
What a CMS user is allowed to do — one of Admin, Copy writer, or Viewer.
_Avoid_: permission level, access tier, rank (implementation phrasing)

**Admin** (Role):
The super admin. Everything a Copy writer can do, plus editing content types and managing CMS users (the Users tab). The only role that can create accounts or assign Roles.
_Avoid_: super admin / superadmin (no separate tier exists — Admin is it), root, owner

**Copy writer** (Role):
Creates, edits, publishes and unpublishes content and media — in the Content admin and Inspect mode alike — but cannot change content types or manage users (the Types pane shows an admin-privileges notice instead of the builder). Stored role value: `editor`; displayed everywhere as Copy writer.
_Avoid_: editor (the stored value, not the display name), content editor, author

**Viewer** (Role):
Read-only access to the CMS.
_Avoid_: guest, read-only user

**Users tab**:
The Admin-only Content admin section for the account lifecycle: create a CMS user, edit their name/email/Role, disable, delete, and reset passwords. Hidden entirely from other Roles. An Admin cannot demote, disable or delete their own account.
_Avoid_: user management screen, accounts page, members

**Temp password**:
The password an Admin types when creating a CMS user or resetting one with "require password change" on. Shared out-of-band (no invite emails); the recipient must replace it at next login.
_Avoid_: OTP, invite code, magic link

**Force password change**:
The state where a CMS user must set a new password at next login before the CMS unlocks — every other action is refused until they do. Entered via the Temp password flows (and the very first seeded Admin); cleared by completing the change.
_Avoid_: password reset (the Admin action that may trigger this), fpu (code shorthand)

**Editor session**:
The logged-in state of a CMS user, carried by a signed session token (held by the browser and mirrored as an httpOnly cookie on the website domain so the server can gate `/admin/*`).
_Avoid_: Login, auth state

**Read-only service token**:
The server-side-only read-only storage credential used to render published content for anonymous visitors and builds. Never reaches the browser; distinct from any CMS user's session.
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

## Consent & cookies

**Cookie Banner**:
The first-visit consent bar pinned to the bottom of every public page, offering equal-prominence Reject all / Manage / Accept all actions. Governs whether non-essential technologies may run; Strictly-necessary technologies are never gated. Distinct from the Site Banner (the brand crest) and the Badge (the pill base component).
_Avoid_: cookie popup, consent popup, Site Banner, Banner (the pill base)

**Cookie Preferences**:
The consent dialog opened from the Cookie Banner's Manage action or the footer's "Cookie preferences" link, listing each Consent category with its purpose and a toggle, plus Save. The one surface for changing or withdrawing consent after the first visit.
_Avoid_: settings modal, cookie settings, preferences panel

**Consent category**:
A group of technologies a visitor allows or refuses as a unit. Two exist: Strictly necessary (always on, uneditable) and Functional. The banner offers only categories that have technologies behind them.
_Avoid_: cookie type, purpose group, tier

**Strictly necessary** (Consent category):
Technologies essential to deliver what the visitor asked for — the Editor session cookies and the Consent choice itself. Exempt from consent under PECR; shown as always-on and uneditable.
_Avoid_: essential (loose), required, mandatory cookies

**Functional** (Consent category):
The non-essential category covering the third-party review embeds — the Trustpilot widget and the Google Reviews widget. Off until the visitor opts in; refusing it suppresses those embeds. The site has no Analytics or Marketing category yet (none of that tech is used).
_Avoid_: third-party, social, marketing (a category the site does not have), analytics (ditto)

**Consent choice**:
The visitor's recorded decision per Consent category, remembered across visits and re-requested when it expires or the category set changes.
_Avoid_: consent state, cookie prefs (implementation phrasing)

**Consent gate**:
The check a non-essential embed makes against the Consent choice before loading its third-party script; when the matching Consent category is refused the embed renders an inert placeholder offering to open Cookie Preferences instead.
_Avoid_: guard, wrapper, feature flag
