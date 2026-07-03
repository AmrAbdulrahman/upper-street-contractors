# @usc/zero-cms-widget

An in-place edit **drawer** for zero-cms. Wrap your app once, then open any entry by
`__id` from anywhere (e.g. an edit pencil) to edit it in a slide-over without leaving
the page. Reuses zero-cms-app's field renderers + EntryEditor (same draft/publish
lifecycle). Environment-independent, react-hook-form, Tailwind.

## Usage

```tsx
import { ZeroCmsWidget, useZeroCmsWidget } from '@usc/zero-cms-widget';
import { createHttpAdapter } from '@usc/zero-cms-core';

const adapter = createHttpAdapter({ baseUrl: '/api' });

function App() {
  return (
    <ZeroCmsWidget adapter={adapter} onSaved={() => revalidate()}>
      <YourApp />
    </ZeroCmsWidget>
  );
}

// anywhere inside:
function EditPencil({ id }: { id: string }) {
  const { openEntry } = useZeroCmsWidget();
  return <button onClick={() => openEntry(id)}>✎</button>;
}
```

`openEntry(id)` resolves the entry's Type from its id via `adapter.locate` (so callers
only need the id); pass `{ type }` to skip the round-trip, or `{ focusField }` to open the
drawer scrolled to + highlighting a field. Inject `richText` to swap the editor.

## Inspect mode (in-place editing)

Pass `inspect` and wrap rendered content with `<ZeroCmsEntry>` / `<ZeroCmsEntryField>`.
In inspect mode each shows a hover "edit" pencil that opens the drawer — an entry, or an
entry focused on one field.

```tsx
<ZeroCmsWidget adapter={adapter} inspect={isInspect}>
  <ZeroCmsEntry entry={project /* { id, type } or { __id, __type } */}>
    <article>
      <ZeroCmsEntryField field="title"><h1>{project.title}</h1></ZeroCmsEntryField>
      <ZeroCmsEntryField field="summary"><p>{project.summary}</p></ZeroCmsEntryField>
    </article>
  </ZeroCmsEntry>
</ZeroCmsWidget>
```

The host decides `inspect` (e.g. from a `?inspect=true` param) — the lib stays
router-independent.

## Behavior

- Accessible slide-over: `role="dialog"`, `aria-modal`, Esc to close, backdrop click to
  dismiss, focus moved into the panel on open.
- The drawer body is zero-cms-app's `EntryEditor`: edits write to `__draft`, with
  Publish / Unpublish / Discard draft / Delete actions.
- `onSaved` fires after any successful mutation so the host can refresh.

## Dependency

Depends on `@usc/zero-cms-app` (renderers + editor) and `@usc/zero-cms-core` (Adapter).

## Tests

`npx vitest run --root libs/zero-cms-widget` — opens the drawer by id and loads the entry.

A live demo is wired at `/admin/widget` in the website app.
