# Contentful query / fragment

Add or extend a colocated GraphQL query or fragment for Contentful data.

Read `docs/agents/project-stack.md`. Use caveman mode.

## Gather from user

- What data is needed (page, section, UI element)
- Whether it's a new query, new fragment, or extending an existing one

## Reference

- Existing fragments: `src/components/sections/**/*.graphql`, `src/components/ui/**/*.graphql`
- Page queries: `src/app/page.graphql`
- Schema: `src/generated/schema.graphql` (run codegen first if stale)
- Codegen config: `codegen.ts`

## Conventions

- Colocate `.graphql` next to the component that consumes it
- Fragment name = PascalCase component name; type = Contentful `__typename`
- Always include `_id`, `__typename`, `sys { id }` for inspection overlays
- Compose shared fragments — don't duplicate field selections
- Use `$preview` variable on collections when preview mode matters
- Import generated documents from `@/generated/graphql` (e.g. `GetHomePageDocument`)

## Steps

1. Explore `src/generated/schema.graphql` for the Contentful type and available fields
2. Write or extend the `.graphql` file
3. Update the consuming `.tsx` to use the generated type/document
4. Run `npm run codegen`
5. Run `npm run lint`

For server components use `getClient().query()` from `@/lib/apollo-server`.
For client components ensure data flows through existing `ApolloProvider` or add a client query with generated hooks from `src/generated/apollo-hooks.ts`.

Report files changed. Flag if Contentful content model needs updating in the CMS.
