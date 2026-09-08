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
- **Codegen**: after any `.graphql` change, run `nx codegen website` (it depends on
  `cms-schema`, so both run). Generated types land in `apps/website/src/generated/graphql.ts`;
  schema SDL in `apps/website/src/generated/schema.graphql`. Add `--skip-nx-cache` after a
  schema change — Nx caches `cms-schema` and a cached run regenerates the OLD SDL.

## Adding a new content Type

1. **Type** — author it via the Types tab at `/admin/cms`, or (preferred, and what every
   existing change did) a new `scripts/seed-*.mjs` following the additive harness in
   `scripts/seed-services-index.mjs`. Both write straight to Redis. Remember
   `allowedTypes` on **`page.sections` and `blog-post.sections`** — two separate snapshots.
2. **Fragment** — create `apps/website/src/components/sections/<name>/<name>.graphql`.
   Codegen globs `apps/website/src/**/*.graphql`, so fragments resolve without imports.
3. **Component** — create `apps/website/src/components/sections/<name>/<name>.tsx` — accept
   fragment type from `@/generated/graphql`.
4. **Barrel** — export from `apps/website/src/components/sections/<name>/index.ts`, and from
   `apps/website/src/components/sections/index.ts`.
5. **Union fragments** — add `... on <GqlType> { ...<Fragment> }` to
   `apps/website/src/components/sections/page-sections.graphql`, in **each union the Type is
   actually allowed on** — `PageSectionBlocks`, `BlogPostSectionBlocks`, `ProjectSectionBlocks`.
   They are byte-identical but cannot share a definition, and missing one is the easiest thing
   to forget. Add it to a union whose `allowedTypes` does NOT list the Type and codegen fails
   with `Fragment cannot be spread here as objects of type "…SectionsRef" can never be of type
   "…"` — the union members are derived from `allowedTypes`, so step 1 decides this, not taste.
6. **Wire PageSection** — add the fragment type to the `PageSectionData` union and the
   `switch` in `apps/website/src/components/sections/page-section.tsx`.
7. **Codegen** — `nx cms-schema website --skip-nx-cache && nx codegen website --skip-nx-cache`.
8. **Restart `next dev`.** The schema is cached once per process in three places (the Engine,
   the `globalThis` read adapter, and the executable GraphQL schema in `lib/cms/query.ts`), so
   a seed script in another process is invisible until restart.

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
| `nx codegen website` | After `.graphql` changes — reads live Redis for the schema, no local fixture. Add `--skip-nx-cache` after a schema change. (There is no `npm run codegen`.) |
| `nx cms-schema website` | Regenerate `generated/schema.graphql` alone — a `codegen` dependency, rarely run by hand |

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
