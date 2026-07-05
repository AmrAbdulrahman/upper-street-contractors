# Project Stack

Reference for agents working in **upper-street-contractors**.

## Core stack

| Layer | Tech |
| ----- | ---- |
| Framework | Next.js 16 (App Router), React 19, TypeScript 5 |
| Styling | Tailwind CSS 4 (`apps/website/src/app/globals.css`, `@tailwindcss/postcss`) |
| CMS | zero-cms — self-hosted, file-system-backed engine (no DB), served by `apps/cms` |
| Client/server data | In-process GraphQL execution against zero-cms's generated schema (`@/lib/cms/query`), no separate API client library |
| Codegen | `@graphql-codegen/*` — colocated `apps/website/src/**/*.graphql` → `apps/website/src/generated/` (schema introspected from the local zero-cms store, not a remote server) |
| Lint | ESLint 9 + `eslint-config-next` |
| Monorepo | Nx workspace — `apps/website` (Next.js, public site), `apps/cms` (Next.js, zero-cms editor + RPC server), shared config at repo root |

See root [`README.md`](../../README.md) → Architecture for the full system diagram
(website ↔ cms, Railway deployment, staging vs production).

## Build modes

Controlled by `NEXT_PUBLIC_APP_ENV` in `.env.local` (see `apps/website/src/lib/app-env.ts`):

- **Production** (unset/anything but `preview`): published content only, no editor UI mounted.
- **Preview** (`NEXT_PUBLIC_APP_ENV=preview`): draft + unpublished content readable, zero-cms
  editor bar + Inspect-mode overlay mounted.

Production is intended to eventually build as `output: "export"` (fully static) with
`apps/cms` as the only write surface — not yet flipped, see
[`docs/cms-railway.md`](../cms-railway.md) for the current blockers.

## Environment variables

Copy `.env.example` → `.env.local`. Key ones:

- `NEXT_PUBLIC_APP_ENV` — `preview` to enable draft content + the editor UI, otherwise production
- `ZERO_CMS_AUTH_SECRET` / `ZERO_CMS_ADMIN_EMAIL` / `ZERO_CMS_ADMIN_PASSWORD` — `apps/cms` auth
- `ZERO_CMS_REMOTE_URL` / `NEXT_PUBLIC_ZERO_CMS_URL` / `ZERO_CMS_SERVICE_EMAIL` / `ZERO_CMS_SERVICE_PASSWORD` — `apps/website` → `apps/cms` (optional locally, required on staging)
- `ZERO_CMS_ALLOWED_ORIGINS` — CORS allow-list on `apps/cms`
- `ZERO_CMS_GIT_SYNC` — auto-commit+push published changes to `main` (Railway only, never local)

Codegen (`codegen.ts`) introspects the zero-cms schema by reading `.zero-cms-store/`
directly (via `scripts/generate-cms-schema.mjs`) — no running server needed for codegen.

## Directory layout

```
apps/cms/                   # zero-cms editor + reference server (Railway)
├── src/
│   ├── app/
│   │   ├── admin/           # Management UI (CmsApp from @usc/zero-cms-app)
│   │   ├── zero-cms/rpc/    # RPC endpoint (create/update/publish/query/...)
│   │   └── api/cms/         # auth, media, graphql, sync-status
│   └── lib/zero-cms/        # server.ts (adapter+auth wiring), git-sync.ts, cors.ts
├── zero-cms.config.mjs      # dir -> ../../.zero-cms-store (shared with website)
└── project.json             # Nx targets: dev (-p 3001), build, start

apps/website/                # Next.js public site + editor-facing preview
├── src/
│   ├── app/                 # App Router pages
│   │   ├── page.tsx
│   │   ├── page.graphql     # Page-level queries
│   │   └── api/enquiry/     # contact-form email (nodemailer)
│   ├── components/
│   │   ├── sections/        # one folder per zero-cms section Type
│   │   ├── ui/               # Reusable UI primitives (Button, Badge, ...)
│   │   └── cms/              # Inspect-mode overlay wiring (CmsInspectShell)
│   ├── generated/            # DO NOT EDIT — graphql.ts, schema.graphql
│   └── lib/
│       ├── cms/query.ts      # in-process GraphQL exec against zero-cms schema
│       └── zero-cms/server.ts  # local-fs adapter (build) or httpAdapter (staging)
├── public/                   # Static assets + generated sitemap.xml
├── next.config.mjs
└── project.json

.zero-cms-store/              # data.json, types/*.json, media/ — git-tracked, shared
                               # by both apps (repo root, not under either app)

# Root (workspace-wide)
codegen.ts                    # GraphQL codegen config
scripts/                      # generate-sitemap.mjs, generate-cms-schema.mjs, ...
nx.json
tsconfig.base.json
```

## GraphQL conventions

- **Colocated fragments**: each component/section has a sibling `.graphql` file with its fragment.
- **Fragment naming**: `PascalCase` matching the component (e.g. `HomeHeroSection` on `HomeHeaderSection`).
- **Preview variable**: page/collection queries take `$status: CmsReadStatus` (`published` or `draft`)
  and `$includeUnpublished: Boolean` — `apps/website/src/lib/cms/query.ts` injects both
  automatically on a preview deploy.
- **Shared fragments**: compose from `apps/website/src/components/ui/**/*.graphql` (e.g. `...Button`, `...Icon`).
- **Codegen**: after any `.graphql` change, run `npm run codegen`. Generated types land in
  `apps/website/src/generated/graphql.ts`; schema SDL in `apps/website/src/generated/schema.graphql`.

## Adding a new content Type

1. **Type** — add a Type file under `.zero-cms-store/types/<name>.json` (or author it via the
   `/admin` UI on `apps/cms`, which writes the file for you).
2. **Fragment** — create `apps/website/src/components/sections/<name>/<name>.graphql`.
3. **Component** — create `apps/website/src/components/sections/<name>/<name>.tsx` — accept
   fragment type from `@/generated/graphql`.
4. **Barrel** — export from `apps/website/src/components/sections/<name>/index.ts`.
5. **Wire PageSection** — add the fragment type to `PageSectionData` union and the `switch` in
   `apps/website/src/components/sections/page-section.tsx`.
6. **Page query** — add the relation field + fragment spread in the owning page query.
7. **Flatten refs** — add the new relation to `apps/website/src/helpers/flatten-section-refs.ts`.
8. **Codegen** — run `npm run codegen`.

Wrap editable fields with the zero-cms-widget Inspect overlay when edit pencils are needed.
Use `RichText` from `@/components/ui/rich-text-viewer` for `blocks` fields.

## UI component pattern

- Folder per component under `apps/website/src/components/ui/<name>/`.
- `index.ts` re-exports public API.
- Optional colocated `.graphql` if the component maps to a zero-cms Type.
- Tailwind utility classes; design tokens in `globals.css` (`bg-surface`, `text-foreground`, etc.).

## Scripts

| Command | When |
| ------- | ---- |
| `npm run dev` | Website dev server only, local-fs read (`nx dev website`) — the simple/default local setup |
| `npm run dev:cms` | zero-cms editor server (`nx dev cms`, port 3001) |
| `npm run dev:all` | Both together — matches staging's real shape |
| `npm run build` | Generates the sitemap from `.zero-cms-store/` then builds `website` |
| `npm run lint` | ESLint |
| `npm run codegen` | After `.graphql` changes — reads the local zero-cms store, no server needed |

## Next.js agent rules

Read `node_modules/next/dist/docs/` before writing Next.js code — this project uses Next.js 16 with breaking changes from earlier versions. `AGENTS.md` has the pointer.

## Slash commands

Stack-specific workflows live in `.cursor/commands/`:

| Command | Purpose |
| ------- | ------- |
| `/caveman` | Activate caveman communication mode |
| `/verify-app` | Browser verify via Chrome DevTools MCP |
| `/grill-me` | Stress-test a plan with grill-with-docs |
| `/add-ui-component` | Scaffold a UI component |
| `/graphql-codegen` | Run codegen and verify output |
