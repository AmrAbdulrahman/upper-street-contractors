# Custom content-api publish route for token-based batch publish

Inspect-mode's "Publish all changes" must publish drafts → published over HTTP, but Strapi's REST content API exposes no publish action, and the admin content-manager publish route requires an admin JWT — we only hold a full-access **API token**. We added a custom content-api route `POST /api/inspect/publish` whose controller loops `strapi.documents(uid).publish({ documentId })`. Full-access API tokens reach content-api routes unconditionally, so no extra permission wiring is needed.

## Considered options

- **Replay edits with `PUT …?status=published`** — rejected: needs one request per entry plus field replay, and fails when an entry was never published before and the published version is missing required fields.
- **Admin content-manager publish route** — rejected: requires an admin JWT, which the website does not have (only an API token).

## Consequences

- The route is gated only by the full-access token (the same trust boundary as the existing `/api/graphql` proxy); a server-side `api::*` allow-list limits it to real content types.
- Adding the route requires a CMS restart to register.
