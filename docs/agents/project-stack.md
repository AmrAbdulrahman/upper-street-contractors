# Project Stack

Reference for agents working in **upper-street-contractors**.

## Core stack

| Layer | Tech |
| ----- | ---- |
| Framework | Next.js 16 (App Router), React 19, TypeScript 5 |
| Styling | Tailwind CSS 4 (`src/app/globals.css`, `@tailwindcss/postcss`) |
| CMS | Contentful GraphQL Content API |
| Client data | Apollo Client 4 + `@apollo/client-integration-nextjs` |
| Codegen | `@graphql-codegen/*` — colocated `src/**/*.graphql` → `src/generated/` |
| Lint | ESLint 9 + `eslint-config-next` |

## Build modes

Controlled by `CONTENTFUL_PREVIEW` in `.env.local`:

- **Production** (`CONTENTFUL_PREVIEW` unset/false): `output: 'export'` — static site. Server Apollo client uses `cache: 'force-cache'`.
- **Preview** (`CONTENTFUL_PREVIEW=true`): standard Next.js server. Draft content via preview token. `cache: 'no-store'`.

See `next.config.ts` and `src/lib/contentful-preview.ts`.

## Environment variables

Copy `.env.example` → `.env.local`:

- `CONTENTFUL_SPACE_ID`, `CONTENTFUL_ENVIRONMENT`, `CONTENTFUL_ACCESS_TOKEN`
- `CONTENTFUL_PREVIEW_TOKEN` (preview mode)
- `CONTENTFUL_PREVIEW` — toggles preview vs static export
- `NEXT_PUBLIC_CONTENTFUL_INSPECTION_MODE` — optional entry inspection overlays

Codegen (`codegen.ts`) also reads `.env.local` for schema introspection.

## Directory layout

```
src/
├── app/                    # App Router pages + API routes
│   ├── page.tsx            # Home — server query via getClient()
│   ├── page.graphql        # Page-level queries
│   └── api/graphql/        # Client-side Apollo proxy → Contentful
├── components/
│   ├── sections/           # Contentful page sections (one folder per section type)
│   ├── ui/                 # Reusable UI primitives (Button, Icon, AtAGlance, …)
│   └── contentful/         # ContentfulEntry wrappers, rich text, inspection overlays
├── generated/              # DO NOT EDIT — graphql.ts, apollo-hooks.ts, schema.graphql
└── lib/
    ├── apollo-client.tsx   # Client Apollo provider (browser → /api/graphql)
    ├── apollo-server.ts    # Server Apollo (RSC, direct Contentful)
    └── contentful/         # Entry URLs, preview helpers
```

## GraphQL conventions

- **Colocated fragments**: each component/section has a sibling `.graphql` file with its fragment.
- **Fragment naming**: `PascalCase` matching the component (e.g. `HomeHeroSection` on `HomeHeaderSection`).
- **Required fields**: every fragment includes `_id`, `__typename`, `sys { id }` for Contentful inspection.
- **Preview variable**: section queries use `$preview` where collections need it.
- **Shared fragments**: compose from `src/components/ui/**/*.graphql` (e.g. `...Button`, `...Icon`).
- **Codegen**: after any `.graphql` change, run `npm run codegen`. Generated hooks land in `src/generated/apollo-hooks.ts`; types in `src/generated/graphql.ts`.

## Contentful section pattern

1. Create `src/components/sections/<name>/<name>.graphql` with fragment on the Contentful type.
2. Create `src/components/sections/<name>/<name>.tsx` — accept fragment type from `@/generated/graphql`.
3. Export from `src/components/sections/<name>/index.ts`.
4. Add fragment to `PageSectionData` union and `switch` in `src/components/sections/page-section.tsx`.
5. Re-export from `src/components/sections/index.ts` if needed.
6. Run `npm run codegen`.

Wrap editable Contentful fields with `ContentfulEntry` / `ContentfulEntryField` from `@/components/contentful` when inspection overlays are needed.

## Apollo usage

- **Server components**: `getClient().query({ query: XDocument })` from `@/lib/apollo-server`. Import documents from `@/generated/graphql`.
- **Client components**: `ApolloProvider` in `layout.tsx`. Browser requests go through `/api/graphql` (`src/app/api/graphql/route.ts`).

## UI component pattern

- Folder per component under `src/components/ui/<name>/`.
- `index.ts` re-exports public API.
- Optional colocated `.graphql` if the component maps to a Contentful type.
- Tailwind utility classes; design tokens in `globals.css` (`bg-surface`, `text-foreground`, etc.).

## Scripts

| Command | When |
| ------- | ---- |
| `npm run dev` | Local dev server |
| `npm run build` | Production/preview build |
| `npm run lint` | ESLint |
| `npm run codegen` | After `.graphql` changes |
| `npm run codegen:watch` | Watch mode during schema work |

## Next.js agent rules

Read `node_modules/next/dist/docs/` before writing Next.js code — this project uses Next.js 16 with breaking changes from earlier versions. `AGENTS.md` has the pointer.

## Slash commands

Stack-specific workflows live in `.cursor/commands/`:

| Command | Purpose |
| ------- | ------- |
| `/caveman` | Activate caveman communication mode |
| `/verify-app` | Browser verify via Chrome DevTools MCP |
| `/grill-me` | Stress-test a plan with grill-with-docs |
| `/add-section` | Scaffold a Contentful page section |
| `/add-ui-component` | Scaffold a UI component |
| `/graphql-codegen` | Run codegen and verify output |
| `/contentful-query` | Add or extend a GraphQL query/fragment |
