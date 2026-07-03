# @usc/zero-cms-blocks

Render + edit structured `blocks` rich text — a dependency-free, Strapi-blocks-compatible
replacement for `@strapi/blocks-react-renderer`.

## Render

```tsx
import { ZeroCmsBlocks } from '@usc/zero-cms-blocks';

<ZeroCmsBlocks
  content={entry.body}                       // BlocksContent (array of nodes)
  blocks={{
    paragraph: ({ children }) => <p className="lead">{children}</p>,
    heading: ({ children, level }) => <h2>{children}</h2>,
    list: ({ children, format }) => (format === 'ordered' ? <ol>{children}</ol> : <ul>{children}</ul>),
    link: ({ children, url }) => <a href={url}>{children}</a>,
  }}
  modifiers={{ bold: ({ children }) => <strong>{children}</strong> }}
/>
```

Same `content` / `blocks` / `modifiers` shape as the Strapi renderer, so existing
override maps port over unchanged. Block kinds: `paragraph`, `heading` (level 1-6),
`list` (+ `list-item`), `quote`, `code`, `image`, `link`. Marks: `bold`, `italic`,
`underline`, `strikethrough`, `code`. Renders `null` for empty content.

## Edit

```tsx
import { BlocksEditor } from '@usc/zero-cms-blocks';
<BlocksEditor value={value} onChange={setValue} />
```

A minimal structured editor: an ordered list of typed blocks (paragraph / heading /
quote / bulleted / numbered) with plain text. Used by zero-cms-app's `blocks` field.

> v1 limitation: editing a block's text replaces its inline children with a single text
> node, so inline marks on an *edited* block are not preserved. Reading keeps full
> fidelity via `<ZeroCmsBlocks>`.

## Tests

`npx vitest run --root libs/zero-cms-blocks` — renderer (headings/marks/lists/overrides)
+ editor (add block, edit text → structured output).
