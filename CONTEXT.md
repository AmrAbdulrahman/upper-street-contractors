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
