# Rich text edited via HugeRTE with bounded blocks⇄HTML conversion

The inspect-mode Edit drawer needs inline rich-text editing, but every richtext field is stored as Strapi `blocks` (JSON) while HugeRTE — the editor we chose — works in HTML. We bundle HugeRTE (self-hosted, no CDN) with a toolbar locked to exactly what `rich-text.tsx` renders (Text/H1–H3, bold, italic, strikethrough, inline code, link, bullet/numbered list) and convert with custom `blocksToHtml`/`htmlToBlocks` helpers. Pasted content outside that set is stripped on save, and the editor warns the user before that happens.

## Considered options

- **Markdown round-trip** — rejected: introduces a third format and the same conversion risk, with no real editor.
- **Blocks-native editor** — rejected: none was chosen; HugeRTE was the requested editor.
- **Treat richtext as unsupported (CMS link only)** — rejected: removes inline rich-text editing entirely.

## Consequences

- Conversion fidelity is bounded to the locked set; images/tables can't round-trip through `blocks` over REST and are dropped (with a warning) rather than silently lost.
- The public renderer must handle every mark the toolbar exposes — `strikethrough` and `code` were added to `rich-text.tsx` — or edited marks wouldn't display on the live site.
