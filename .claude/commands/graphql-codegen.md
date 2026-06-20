# GraphQL codegen

Regenerate types and hooks after `.graphql` file changes.

Read `docs/agents/project-stack.md`. Use caveman mode.

## Steps

1. Confirm Strapi is running (`npm run dev:cms`) and `.env.local` has `STRAPI_URL` and `STRAPI_API_TOKEN` (see `.env.example`)

2. Run `npm run codegen`

3. Verify output updated:
   - `apps/website/src/generated/graphql.ts` — types + document nodes
   - `apps/website/src/generated/apollo-hooks.ts` — React Apollo hooks
   - `apps/website/src/generated/schema.graphql` — introspected schema

4. Fix any codegen errors (missing fragments, schema drift, typos in `.graphql` files)

5. Run `npm run lint` on files that import from `@/generated/`

Report what changed. If codegen fails, show error and which `.graphql` file likely caused it.
