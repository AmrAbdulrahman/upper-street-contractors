# Project Stack

Reference for agents working in **upper-street-contractors**.

## Core stack

| Layer | Tech |
| ----- | ---- |
| Framework | Next.js 16 (App Router), React 19, TypeScript 5 |
| Styling | Tailwind CSS 4 (`apps/website/src/app/globals.css`, `@tailwindcss/postcss`) |
| CMS | Strapi 5 GraphQL API (`apps/cms`) |
| Client data | Apollo Client 4 + `@apollo/client-integration-nextjs` |
| Codegen | `@graphql-codegen/*` — colocated `apps/website/src/**/*.graphql` → `apps/website/src/generated/` |
| Lint | ESLint 9 + `eslint-config-next` |
| Monorepo | Nx workspace — `apps/website` (Next.js), `apps/cms` (Strapi 5), shared config at repo root |

## Build modes

Controlled by `ENABLE_PREVIEW` in `.env.local`:

- **Production** (`ENABLE_PREVIEW` unset/false): `output: 'export'` — static site. Server Apollo client uses `cache: 'force-cache'`.
- **Preview** (`ENABLE_PREVIEW=true`): standard Next.js server. Draft content via `$status: DRAFT`. `cache: 'no-store'` where applicable.

See `apps/website/next.config.mjs` and `apps/website/src/helpers/preview-utils.ts`.

## Environment variables

Copy `.env.example` → `.env.local`:

- `STRAPI_URL` — Strapi server URL (default `http://localhost:1337`)
- `NEXT_PUBLIC_STRAPI_URL` — public Strapi URL for inspection overlays
- `STRAPI_API_TOKEN` — full-access API token from Strapi admin (Settings → API Tokens)
- `STRAPI_TRANSFER_TOKEN` — transfer token for `cms:push` / `cms:pull` (Settings → Transfer Tokens on cloud)
- `STRAPI_CLOUD_URL` — cloud Strapi URL for push/pull (preferred; avoids shell `STRAPI_URL=localhost` conflicts)
- `ENABLE_PREVIEW` — toggles preview vs static export
- `NEXT_PUBLIC_STRAPI_INSPECTION_MODE` — optional entry inspection overlays

Codegen (`codegen.ts`) introspects `${STRAPI_URL}/graphql` using `STRAPI_API_TOKEN`. Strapi must be running for codegen.

## Directory layout

```
apps/cms/                   # Strapi 5 headless CMS (isolated node_modules — React 18)
├── src/api/                # Content types (schema.json per type)
├── config/                 # server, database, plugins
├── public/uploads/         # media uploads
└── project.json            # Nx targets: dev, build, start, console

apps/website/               # Next.js application
├── src/
│   ├── app/                # App Router pages + API routes
│   │   ├── page.tsx        # Home — server query via getClient()
│   │   ├── page.graphql    # Page-level queries
│   │   └── api/graphql/    # Client-side Apollo proxy → Strapi
│   ├── components/
│   │   ├── sections/       # Strapi page sections (one folder per section type)
│   │   ├── ui/             # Reusable UI primitives (Button, Icon, AtAGlance, …)
│   │   └── strapi/         # StrapiEntry wrappers, rich text, inspection overlays
│   ├── generated/          # DO NOT EDIT — graphql.ts, apollo-hooks.ts, schema.graphql
│   ├── helpers/            # flatten-section-refs, strapi-media-url, preview-utils, …
│   └── lib/
│       ├── apollo-client.tsx   # Client Apollo provider (browser → /api/graphql)
│       ├── apollo-server.ts    # Server Apollo (RSC, direct Strapi)
│       └── apollo-preview-link.ts  # Injects $status for draft content
├── public/                 # Static assets + generated sitemap.xml
├── next.config.mjs
└── project.json            # Nx project config

# Root (workspace-wide)
codegen.ts                  # GraphQL codegen config
scripts/                    # Workspace scripts (sitemap generation)
nx.json                     # Nx workspace config
tsconfig.base.json          # Shared TypeScript config
```

## GraphQL conventions

- **Colocated fragments**: each component/section has a sibling `.graphql` file with its fragment.
- **Fragment naming**: `PascalCase` matching the component (e.g. `HomeHeroSection` on `HomeHeaderSection`).
- **Required fields**: every fragment includes `documentId` for Strapi inspection overlays. Include `__typename` where polymorphic resolution is needed.
- **Preview variable**: page/collection queries use `$status: PublicationStatus` (`PUBLISHED` or `DRAFT`). Pass `withPreviewVariables()` from `@/helpers/preview-utils` in server queries when preview mode matters.
- **Shared fragments**: compose from `apps/website/src/components/ui/**/*.graphql` (e.g. `...Button`, `...Icon`).
- **Codegen**: after any `.graphql` change, run `npm run codegen`. Generated hooks land in `apps/website/src/generated/apollo-hooks.ts`; types in `apps/website/src/generated/graphql.ts`.

## Strapi section pattern

1. **Content type** — create or extend a Strapi content type in `apps/cms/src/api/<name>/content-types/<name>/schema.json`. Add a relation field on `section-ref` if the section appears on pages.
2. **Fragment** — create `apps/website/src/components/sections/<name>/<name>.graphql` with fragment on the Strapi GraphQL type.
3. **Component** — create `apps/website/src/components/sections/<name>/<name>.tsx` — accept fragment type from `@/generated/graphql`.
4. **Barrel** — export from `apps/website/src/components/sections/<name>/index.ts`.
5. **Wire PageSection** — add fragment type to `PageSectionData` union and `switch` in `apps/website/src/components/sections/page-section.tsx`.
6. **Page query** — add the relation field + fragment spread under `section_refs` in `apps/website/src/app/page.graphql` (or the owning page query). Include `__typename` on the relation field.
7. **Flatten refs** — add the new relation to `apps/website/src/helpers/flatten-section-refs.ts`.
8. **Codegen** — run `npm run codegen` (Strapi must be running with a valid API token).

Wrap editable Strapi fields with `StrapiEntry` / `StrapiEntryField` from `@/components/strapi` when inspection overlays are needed. Use `RichText` from `@/components/strapi/rich-text` for blocks fields.

## Apollo usage

- **Server components**: `getClient().query({ query: XDocument, variables: withPreviewVariables() })` from `@/lib/apollo-server`. Import documents from `@/generated/graphql`.
- **Client components**: `ApolloProvider` in `layout.tsx`. Browser requests go through `/api/graphql` (`apps/website/src/app/api/graphql/route.ts`).

## UI component pattern

- Folder per component under `apps/website/src/components/ui/<name>/`.
- `index.ts` re-exports public API.
- Optional colocated `.graphql` if the component maps to a Strapi content type.
- Tailwind utility classes; design tokens in `globals.css` (`bg-surface`, `text-foreground`, etc.).

## Scripts

| Command | When |
| ------- | ---- |
| `npm run dev` | Website dev server (`nx dev website`) |
| `npm run dev:cms` | Strapi dev server (`nx dev cms`) |
| `npm run build` | Production/preview build (`nx build website`) |
| `npm run lint` | ESLint |
| `npm run codegen` | After `.graphql` changes (Strapi must be running) |
| `npm run codegen:watch` | Watch mode during schema work |
| `npm run cms:push` | Push local Strapi data/assets to cloud (destructive — overwrites cloud) |
| `npm run cms:pull` | Pull cloud Strapi data/assets to local (destructive — overwrites local) |

Cloud GraphQL introspection is enabled in `apps/cms/config/plugins.ts`; redeploy cms to Strapi Cloud after changing that config.

## Next.js agent rules

Read `node_modules/next/dist/docs/` before writing Next.js code — this project uses Next.js 16 with breaking changes from earlier versions. `AGENTS.md` has the pointer.

## Slash commands

Stack-specific workflows live in `.cursor/commands/`:

| Command | Purpose |
| ------- | ------- |
| `/caveman` | Activate caveman communication mode |
| `/verify-app` | Browser verify via Chrome DevTools MCP |
| `/grill-me` | Stress-test a plan with grill-with-docs |
| `/add-section` | Scaffold a Strapi page section |
| `/add-ui-component` | Scaffold a UI component |
| `/graphql-codegen` | Run codegen and verify output |
| `/strapi-query` | Add or extend a GraphQL query/fragment |
