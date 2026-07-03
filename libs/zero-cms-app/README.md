# @usc/zero-cms-app

React UI to manage a zero-cms instance — **Content** (entries), **Types** (schema
builder), and **Media**. Schema-driven and environment-independent: inject an
`Adapter` from `@usc/zero-cms-core`, no router, Tailwind-styled, forms via
react-hook-form.

## Usage

```tsx
import { ZeroCmsApp } from '@usc/zero-cms-app';
import { createHttpAdapter } from '@usc/zero-cms-core';

const adapter = createHttpAdapter({ baseUrl: '/api' }); // or a node adapter on the server
export default () => <ZeroCmsApp adapter={adapter} />;
```

Optional pluggable rich-text editor (defaults to a textarea):

```tsx
<ZeroCmsApp adapter={adapter} richText={MyEditor} />
// MyEditor: (props: { value: string; onChange: (v: string) => void }) => JSX.Element
```

## What it does

- **Content** — per-Type listing with search + status filter (All / Published / Has
  draft / Unpublished), built on `adapter.query`. Editing opens a slide-over with a
  dynamic form. Edits save to `__draft`; buttons for Publish / Unpublish / Discard
  draft / Delete. Lists every entry (uses `includeUnpublished`).
- **Types** — add/remove Types and Fields, set `__type`, `required`, and per-kind meta
  (lookup options, asset accept, reference allowed types). Saves the whole Schema via
  `adapter.saveSchema` (destructive edits are blocked and shown as errors).
- **Media** — upload (through the Adapter), image thumbnails, delete (blocked while a
  media item is referenced).

## Extensibility

`fieldRegistry` (keyed by `__type`), `EntryForm`, `EntriesList`, `EntryEditor`,
`TypeBuilder`, `MediaLibrary`, and `useZeroCms()` are all exported so you can compose a
custom shell or swap field renderers.

## Styling

Tailwind utility classes only (no custom CSS). Ensure your Tailwind `content` globs
include `libs/zero-cms-app/src/**/*.{ts,tsx}` so the classes are generated.

## Tests

`npx vitest run --root libs/zero-cms-app` — jsdom render + create-draft flow.
