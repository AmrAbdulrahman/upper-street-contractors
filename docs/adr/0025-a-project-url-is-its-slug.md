# 25. A Project's URL is its Slug, and its uuid redirects there

Date: 2026-09-12

## Status

Accepted

## Context

A Project's public address was its storage id:

```
/projects/ebec33b3-d9dc-4d98-9a7b-dd217ced3fba
```

Every other addressable thing on the site already had a real URL. A Blog Post
has had a Slug since it existed (`/blog/when-rewiring-is-worth-it`), and a
Service page got one when the nine route files collapsed into one dynamic route
(ADR 0020). A Project was the exception, and not for a reason — the uuid was
simply what `adapter.create` handed back, and the route took it.

That mattered more for Projects than it would for most content, because the
Projects are the commercial pages. They are the case studies a search result is
most likely to want to show, and a uuid is the one URL shape that carries no
signal at all: not to a search engine ranking it, and not to a person deciding
whether to click a link somebody pasted into a message.

The URLs were also already public — in the sitemap, on every Project card, and
in whatever has been shared. Anything we did had to keep them working.

## Decision

`project` gains a `slug` field of kind `slug`, with `from: 'title'` — the same
declaration a Blog Post carries, so it behaves the same way: derived from the
title while untouched, detached permanently the first time an editor edits it,
pattern-validated by core on every write.

The route segment is `/projects/[slug]` and **resolves both shapes**:

1. Look the Project up by slug. That is the URL now, and the one every internal
   link builds.
2. If nothing matches and the segment is shaped like a uuid, look it up by id.
3. If that finds a Project **and** the Project has a slug, `permanentRedirect`
   to the slug URL, and — regardless of whether the redirect's 308 survives —
   emit the canonical as the slug URL.

Step 3's second half is the part that carries the SEO weight. Next returns
`200` for a streamed response and cannot change the status once the body has
begun (its `loading.js` "Status Codes" docs say so explicitly), so the 308 a
`permanentRedirect` asks for is delivered inside the stream and moves a
visitor's browser, not the response code a crawler sees. The canonical is what
tells a crawler the two addresses are one page and which one to keep, and it is
set in `generateMetadata`, which resolves before anything streams.

A uuid that names a Project with **no** slug is served, not redirected. Those
exist: a Project created before the field, or a Duplicate, whose Slug is
deliberately cleared so it re-derives (ADR 0017).

`generateStaticParams` prerenders slugs only. Both shapes resolve, but
prerendering both would build every Project twice and put two URLs for one page
into the output.

## Consequences

Existing Projects were backfilled by `scripts/seed-project-slugs.mjs`, which
derives each slug from the title and **de-duplicates as it goes** (`-2`, `-3`,
…). zero-cms enforces no uniqueness on `slug`, and the route takes the first
match, so two Projects claiming one slug would leave the second permanently
unreachable — the one failure mode this migration could have introduced and
the reason the script does not simply slugify each title independently.

The field is **not** `required`. Publish rewrites every declared field, so a
required field with nothing stored would turn every publish of a pre-existing
Project into a validation failure. The uuid fallback is what makes optional
safe: a Project with no slug is still reachable.

`getAllSitePaths` now emits the slug where there is one and the uuid where
there is not, so the sitemap and the post-publish cache-warm pass (ADR 0012)
both name the URL a visitor actually lands on rather than one that redirects.

The cost is one extra CMS read on the compatibility path: a uuid request
queries by slug, misses, then queries by id. It is bounded to requests that
arrive on an old URL, and a mistyped slug pays nothing extra — the id lookup is
attempted only for something actually shaped like a uuid.
