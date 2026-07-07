# Project Stack

Reference for agents working in **upper-street-contractors**.

## Core stack

| Layer | Tech |
| ----- | ---- |
| Framework | Next.js 16 (App Router), React 19, TypeScript 5 |
| Styling | Tailwind CSS 4 (`apps/website/src/app/globals.css`, `@tailwindcss/postcss`) |
| CMS | zero-cms — self-hosted engine, one Next.js app (`apps/website`) serves both the public site and the editor |
| CMS storage | Upstash Redis (per-record keys, CAS via Lua `EVAL`) + Vercel Blob (media) — ADR 0008/0009. No filesystem, no database server to run. |
| Client/server data | In-process GraphQL execution against zero-cms's generated schema (`@/lib/cms/query`), no separate API client library |
| Codegen | `@graphql-codegen/*` — colocated `apps/website/src/**/*.graphql` → `apps/website/src/generated/` (schema introspected from live Redis via `scripts/generate-cms-schema.mjs`, not a local fixture) |
| Lint | ESLint 9 + `eslint-config-next` |
| Monorepo | Nx workspace — one app, `apps/website`; shared config at repo root |

See root [`README.md`](../../README.md) → Architecture for the full system diagram
(single app, Draft Mode preview, Vercel deployment).

## Preview / Draft Mode

Preview is Next's built-in **Draft Mode** (`draftMode()` from `next/headers`), not a
build-time env var — see `apps/website/src/lib/app-env.ts`.

- **Production** (`/`, `/about`, `/projects/[id]`, ...): published content only, no
  editor UI.
- **`/admin/*`** (except `/admin/cms`, the dashboard app): `proxy.ts` gates on the
  `zero_cms_session` cookie, enables Draft Mode via `/admin/enable-preview`
  (the only place `draftMode().enable()` can run — Route Handler requirement), then
  **rewrites** to the matching `(site)` page — `/admin/projects/1` renders the exact
  same page as `/projects/1`, just with Draft Mode on, so `isPreview()` is true and
  the zero-cms editor bar + Inspect overlay mount.
- **`/admin/cms`**: the real dashboard (Types, Entries, Media, Users) — `CmsApp` from
  `@usc/zero-cms-app`, gated client-side by `AuthGate` (its own login form).

`/admin/*` is `disallow`ed in `robots.ts` and never appears in the generated sitemap.

## Environment variables

Copy `.env.example` → `.env.local`. Key ones:

- `STORAGE_KV_REST_API_URL` / `STORAGE_KV_REST_API_TOKEN` / `STORAGE_KV_REST_API_READ_ONLY_TOKEN` — Upstash Redis (Vercel Marketplace integration). Read-only token for all page rendering (public + `/admin` preview), read-write only for the RPC surface.
- `BLOB_READ_WRITE_TOKEN` — Vercel Blob (media bytes).
- `ZERO_CMS_AUTH_SECRET` — signs session JWTs; also verified in `proxy.ts`.
- `ZERO_CMS_ADMIN_EMAIL` / `ZERO_CMS_ADMIN_PASSWORD` — first-admin seed (only used once, when the Redis `users` set is empty).

Codegen (`codegen.ts`) introspects the zero-cms schema by reading **live Redis**
(`scripts/generate-cms-schema.mjs`, via `createRedisAdapter` + the read-only token) —
needs network access to Upstash, same as `next build` itself.

## Directory layout

```
apps/website/                # Next.js — public site + zero-cms editor, one app
├── src/
│   ├── proxy.ts              # Next 16 Proxy (was middleware.ts) — gates + rewrites /admin/*
│   ├── app/
│   │   ├── (site)/           # Public pages — also what /admin/* rewrites into
│   │   ├── admin/
│   │   │   ├── cms/[[...rest]]/  # CmsApp dashboard (Types, Entries, Media, Users)
│   │   │   └── enable-preview/   # Route Handler: draftMode().enable(), then redirect
│   │   ├── zero-cms/rpc/     # RPC endpoint (create/update/publish/query/...)
│   │   └── api/cms/          # auth (sets the session cookie too), media, graphql
│   ├── components/
│   │   ├── sections/         # one folder per zero-cms section Type
│   │   ├── ui/                # Reusable UI primitives (Button, Badge, ...)
│   │   └── cms/               # Inspect-mode overlay wiring (CmsInspectShell)
│   ├── generated/             # DO NOT EDIT — graphql.ts, schema.graphql
│   └── lib/
│       ├── cms/query.ts       # in-process GraphQL exec against zero-cms schema
│       ├── app-env.ts         # isPreview() — Draft Mode check
│       └── zero-cms/server.ts # dual Redis adapters (read-only / read-write) + auth
├── public/                    # Static assets
├── next.config.mjs
└── project.json

# Root (workspace-wide)
codegen.ts                     # GraphQL codegen config
scripts/                       # generate-cms-schema.mjs, ...
nx.json
tsconfig.base.json
```

## GraphQL conventions

- **Colocated fragments**: each component/section has a sibling `.graphql` file with its fragment.
- **Fragment naming**: `PascalCase` matching the component (e.g. `HomeHeroSection` on `HomeHeaderSection`).
- **Preview variable**: page/collection queries take `$status: CmsReadStatus` (`published` or `draft`)
  and `$includeUnpublished: Boolean` — `apps/website/src/lib/cms/query.ts` injects both
  automatically whenever `isPreview()` is true.
- **Shared fragments**: compose from `apps/website/src/components/ui/**/*.graphql` (e.g. `...Button`, `...Icon`).
- **Codegen**: after any `.graphql` change, run `npm run codegen`. Generated types land in
  `apps/website/src/generated/graphql.ts`; schema SDL in `apps/website/src/generated/schema.graphql`.

## Adding a new content Type

1. **Type** — author it via the Types tab at `/admin/cms` (writes straight to Redis).
2. **Fragment** — create `apps/website/src/components/sections/<name>/<name>.graphql`.
3. **Component** — create `apps/website/src/components/sections/<name>/<name>.tsx` — accept
   fragment type from `@/generated/graphql`.
4. **Barrel** — export from `apps/website/src/components/sections/<name>/index.ts`.
5. **Wire PageSection** — add the fragment type to `PageSectionData` union and the `switch` in
   `apps/website/src/components/sections/page-section.tsx`.
6. **Page query** — add the relation field + fragment spread in the owning page query.
7. **Flatten refs** — add the new relation to `apps/website/src/helpers/flatten-section-refs.ts`.
8. **Codegen** — run `npm run codegen` (reads the new Type straight from Redis).

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
| `npm run dev` | The only dev entrypoint — one app, one process (`nx dev website`) |
| `npm run build` | Builds `website` (also regenerates the zero-cms GraphQL SDL as a dependent Nx target); `app/sitemap.ts` reads live Redis at request time, no separate build step |
| `npm run lint` | ESLint |
| `npm run codegen` | After `.graphql` changes — reads live Redis for the schema, no local fixture |

## Next.js agent rules

Read `node_modules/next/dist/docs/` before writing Next.js code — this project uses Next.js 16 with breaking changes from earlier versions. `AGENTS.md` has the pointer. In particular: Middleware is renamed **Proxy** (`proxy.ts`, not `middleware.ts`), runs on the **Node.js runtime by default**, and `draftMode().enable()`/`.disable()` only work inside a Route Handler.

## Slash commands

Stack-specific workflows live in `.cursor/commands/`:

| Command | Purpose |
| ------- | ------- |
| `/caveman` | Activate caveman communication mode |
| `/verify-app` | Browser verify via Chrome DevTools MCP |
| `/grill-me` | Stress-test a plan with grill-with-docs |
| `/add-ui-component` | Scaffold a UI component |
| `/graphql-codegen` | Run codegen and verify output |
