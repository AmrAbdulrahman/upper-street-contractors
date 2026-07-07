# GraphQL codegen

Regenerate types after `.graphql` file changes.

Read `docs/agents/project-stack.md`. Use caveman mode.

## Steps

1. Run `npm run codegen` — reads the local zero-cms store directly (`.zero-cms-store/`), no
   server needs to be running

2. Verify output updated:
   - `apps/website/src/generated/graphql.ts` — types + typed document nodes
   - `apps/website/src/generated/schema.graphql` — introspected schema (from zero-cms, not a
     remote server)

3. Fix any codegen errors (missing fragments, schema drift, typos in `.graphql` files)

4. Run `npm run lint` on files that import from `@/generated/`

Report what changed. If codegen fails, show error and which `.graphql` file likely caused it.
