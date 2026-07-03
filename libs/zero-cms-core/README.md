# @usc/zero-cms-core

A standalone, file-system-backed CMS engine. No database — a base directory holds
everything. Generates a typed client from the schema. See `CONTEXT.md` for the
ubiquitous language and `docs/adr/0003..0006` for the load-bearing decisions.

## Base directory

```
<dir>/
  types/<name>.json   # Schema: one Type per file (glob-configurable)
  data.json           # all Entries (tracked in git)
  media/              # image/video files
  media/index.json    # media manifest (id -> file metadata)
  generated/          # generated typed client (config `generated`)
```

## Config (`zero-cms.config.mjs`)

```js
export default {
  dir: '.zero-cms-store',     // base dir (default: the config file's dir)
  generated: 'generated',     // typed-client output (importable, e.g. via @cms alias)
  types: 'types/**/*.json',   // glob for type files (one Type per file)
  typesDir: 'types',          // where new/migrated types are written
};
```

`loadConfig()` walks up from cwd to find it. Type edits write back to each Type's source
file; a legacy single `types.json` is read and migrated to per-type files on first save.

## Two entry points

- `@usc/zero-cms-core` — **universal / browser-safe** (no `node:` imports): model
  types, `Store`/`bindStore`, `Adapter` type, `createHttpAdapter`, codegen string
  generator. Import this from React (zero-cms-app / zero-cms-widget) and generated code.
- `@usc/zero-cms-core/node` — **node only**: `Engine`, fs storage, `createNodeFsAdapter`,
  codegen writer/`watchSchema`, and the reference server `createRequestHandler`.

## Node usage (in-process)

```ts
import { createNodeFsAdapter } from '@usc/zero-cms-core/node';
import { createClient } from './<base>/.zero-cms/generated';

const adapter = await createNodeFsAdapter('/path/to/base');
const cms = createClient(adapter);

const p = await cms.projectStore.create({ title: 'Loft' }); // lands in __draft
await cms.projectStore.publish(p.__id);                      // draft -> live values
const live = await cms.projectStore.query();                  // status defaults to 'published'
const preview = await cms.projectStore.get(p.__id, { status: 'draft', populate: ['author'] });
```

## Browser usage (over HTTP)

```ts
// server (e.g. a Next route handler)
import { createNodeFsAdapter, createRequestHandler } from '@usc/zero-cms-core/node';
const handle = createRequestHandler(await createNodeFsAdapter(base));
export const POST = (req: Request) => handle(req); // mounts at /zero-cms/rpc

// browser
import { createHttpAdapter } from '@usc/zero-cms-core';
import { createClient } from './generated';
const cms = createClient(createHttpAdapter({ baseUrl: '/api' }));
```

## Codegen

```ts
import { generate, watchFromConfig } from '@usc/zero-cms-core/node';
await generate();                            // load zero-cms.config.* and emit -> generated/
const w = await watchFromConfig(undefined, { onGenerate: (f) => console.log('wrote', f) });
```

Then import the typed client from the generated dir (e.g. behind a `@cms` alias):

```ts
import { createClient, type Project } from '@cms';
const cms = createClient(adapter);
```

In Next, an `instrumentation.ts` calling `watchFromConfig(process.cwd())` regenerates on
type changes during dev.

## Strapi migration

Convert Strapi content-type `schema.json` files into zero-cms type files:

```ts
import { strapiSchemaToZeroCms } from '@usc/zero-cms-core/node';

const { schema, warnings } = await strapiSchemaToZeroCms('apps/cms/src/api');
// write each schema[i] to <typesDir>/<__name>.json
```

Mapping: string→text, text→longtext, blocks→blocks, integer/decimal→number,
enumeration→lookup, media→asset, relation (one/manyToOne)→reference,
(one/manyToMany)→references, json→json. Components/dynamic zones are skipped with a
warning. (`migrateStrapiSchemas` is the pure, fs-free core for testing.)

## Auth (optional)

Users live in `<dir>/users.json` (scrypt-hashed passwords, never exposed). Sessions are
HS256 tokens signed with `ZERO_CMS_AUTH_SECRET`. Roles: **admin** (types + users +
content), **editor** (content + publish), **viewer** (read drafts/preview only).

```ts
import { Auth, createAuthHandler, createRequestHandler } from '@usc/zero-cms-core/node';

const auth = await Auth.load(port, { secret: process.env.ZERO_CMS_AUTH_SECRET! });
await auth.seedFromEnv(); // seeds first admin from ZERO_CMS_ADMIN_EMAIL/PASSWORD if empty

// Auth endpoint (login / me / changePassword / user admin)
const authHandle = createAuthHandler(auth);
// Enforce on the RPC surface (Bearer token + role checks)
const rpcHandle = createRequestHandler(adapter, { auth });
// GraphQL: pass `auth` → anonymous reads clamp to published, mutations need editor
```

Enforcement: the RPC surface is admin-only (role-gated per op); GraphQL keeps **published
reads public** and requires an `editor`+ session for mutations / draft reads.

## Store API (per Type)

`create` `update` `patch` (write to `__draft`) · `publish` `unpublish` `discardDraft`
· `delete` (blocked while referenced — draft refs count) · `get` `list` `query`
(`status` selects the version; filter via `where.__status` / `where.hasDraft`) ·
`validateRefs`.

## v1 constraints

- Single writer process per base directory (in-process mutex, no cross-process lock).
- `data.json` is a single file (fine at CMS scale).
- Typed populate returns ids on the base entity type; deeply-typed populated reads use
  the generated `*Populated` interfaces.

## Dev

- `npx vitest run --root libs/zero-cms-core` — unit tests.
- `libs/zero-cms-core/example/` — sample `types.json` + generated client.
