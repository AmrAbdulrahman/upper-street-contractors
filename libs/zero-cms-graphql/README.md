# @usc/zero-cms-graphql

The **opt-in GraphQL layer** for zero-cms (ADR 0005). Generates a GraphQL schema
(SDL + resolvers) from a CMS Schema and serves it with the same `Adapter` that backs
the generated stores. Core stays GraphQL-agnostic — you only pull this in (and
`graphql` + `@graphql-tools/schema`) if you want GraphQL instead of the typed store.

## Usage

```ts
import { buildCmsSchema, createGraphQLHandler, generateSdl } from '@usc/zero-cms-graphql';

// Executable schema (mount in any GraphQL server)
const schema = buildCmsSchema({ schema: await adapter.getSchema(), adapter });

// …or a ready Fetch handler (rebuilds when the CMS schema changes) + GraphiQL on GET
const handle = createGraphQLHandler({ adapter });
// Next route: export const POST = (r: Request) => handle(r); export const GET = handle;

// SDL string (docs / client codegen)
const sdl = generateSdl(await adapter.getSchema());
```

A route is wired in the website at **`/api/cms/graphql`** (POST = execute, GET = GraphiQL).

## Generated schema (per Type `T`)

- **Object** `T { id type status hasDraft …fields }` — `id/type/status/hasDraft` map
  from `__id/__type/__status/hasDraft`. Lookups → enums (when options are valid GraphQL
  names), single references → the target object type, multi-target references → a union,
  `references` → a list.
- **Query**: `t(id, status)` and `ts(where, sort, limit, offset, status, includeUnpublished): TPage`.
  Reference fields are resolved in one engine call — `populate` is derived from the
  selection set, so `{ project { author { name } } }` just works.
- **Mutation**: `createT / updateT / patchT / deleteT / publishT / unpublishT / discardDraftT`,
  one-to-one with the store operations. Drafts and validation behave exactly as the store
  (e.g. publishing enforces `required`).
- **Filtering**: `where` uses `StringFilter` / `BooleanFilter` (`eq, ne, in, nin, contains,
  gt/gte/lt/lte, exists`), plus `status` and `hasDraft`. Maps 1:1 to the serializable
  engine filter DSL.

## Tests

`npx vitest run --root libs/zero-cms-graphql` — SDL shape, a list query with `where` +
nested reference resolution, and create/publish mutations.

> Note: when running graphql under Vitest, the lib's `vitest.config.mts` dedupes/inlines
> `graphql` + `@graphql-tools/*` to avoid the "two graphql realms" error.
