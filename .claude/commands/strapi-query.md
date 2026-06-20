# Strapi query / fragment

Add or extend a colocated GraphQL query or fragment for Strapi data.

Read `docs/agents/project-stack.md`. Use caveman mode.

## Gather from user

- What data is needed (page, section, UI element)
- Whether it's a new query, new fragment, or extending an existing one

## Reference

- Existing fragments: `apps/website/src/components/sections/**/*.graphql`, `apps/website/src/components/ui/**/*.graphql`
- Page queries: `apps/website/src/app/page.graphql`
- Schema: `apps/website/src/generated/schema.graphql` (run codegen first if stale)
- Codegen config: `codegen.ts`

## Conventions

- Colocate `.graphql` next to the component that consumes it
- Fragment name = PascalCase component name; type = Strapi GraphQL type (e.g. `WhoWeAreSection`)
- Always include `documentId` for inspection overlays; add `__typename` where polymorphic resolution is needed
- Compose shared fragments — don't duplicate field selections
- Use `$status: PublicationStatus` on collection/single-type queries when preview mode matters
- Import generated documents from `@/generated/graphql` (e.g. `GetHomePageDocument`)

## Steps

1. Explore `apps/website/src/generated/schema.graphql` for the Strapi type and available fields
2. Write or extend the `.graphql` file
3. Update the consuming `.tsx` to use the generated type/document
4. Run `npm run codegen` (Strapi must be running with `STRAPI_API_TOKEN` set)
5. Run `npm run lint`

For server components use `getClient().query()` from `@/lib/apollo-server` with `withPreviewVariables()` when draft content is needed.
For client components ensure data flows through existing `ApolloProvider` or add a client query with generated hooks from `apps/website/src/generated/apollo-hooks.ts`.

Report files changed. Flag if Strapi content type schema needs updating in `apps/cms`.
