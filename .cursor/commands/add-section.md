# Add Contentful page section

Scaffold a new page section wired into the Contentful → GraphQL → React pipeline.

Read `docs/agents/project-stack.md` for conventions. Use caveman mode.

## Gather from user

- Section name (kebab-case folder name)
- Contentful GraphQL type name (e.g. `WhoWeAreSection`)
- Key fields from Contentful (or explore `src/generated/schema.graphql` after codegen)

## Steps

1. **Fragment** — create `src/components/sections/<name>/<name>.graphql`:
   - `fragment <PascalName> on <ContentfulType> { _id __typename sys { id } ... }`
   - Compose shared fragments from `src/components/ui/` where needed (`...Button`, `...Icon`, etc.)
   - Use `$preview` on collections when draft content matters

2. **Component** — create `src/components/sections/<name>/<name>.tsx`:
   - Import fragment type from `@/generated/graphql`
   - Wrap editable Contentful nodes with `ContentfulEntry` / `ContentfulEntryField` from `@/components/contentful`
   - Use `RichText` from `@/components/contentful` for rich text fields
   - Tailwind classes matching existing sections

3. **Barrel** — create `src/components/sections/<name>/index.ts` exporting the component

4. **Wire PageSection** — update `src/components/sections/page-section.tsx`:
   - Add fragment type to `PageSectionData` union
   - Add `case "<ContentfulType>":` to the switch

5. **Page query** — if the section isn't already fetched, add `...<PascalName>` to the relevant query in `src/app/page.graphql` (or the page that owns the section)

6. **Codegen** — run `npm run codegen` (requires `.env.local` with Contentful credentials)

7. **Verify** — `npm run lint`; confirm types resolve and section renders

Report files created/changed. Note if Contentful content model entry must be created manually in Contentful UI.
