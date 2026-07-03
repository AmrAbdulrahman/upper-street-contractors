# Add Strapi page section

Scaffold a new page section wired into the Strapi → GraphQL → React pipeline.

Read `docs/agents/project-stack.md` for conventions. Use caveman mode.

## Gather from user

- Section name (kebab-case folder name)
- Strapi GraphQL type name (e.g. `WhoWeAreSection`)
- Key fields from Strapi (or explore `apps/website/src/generated/schema.graphql` after codegen)

## Steps

1. **Content type** (if new) — create Strapi schema in `apps/cms/src/api/<name>/content-types/<name>/schema.json`. Add a `oneToOne` relation on `section-ref` (`apps/cms/src/api/section-ref/content-types/section-ref/schema.json`). Restart Strapi and run codegen to refresh schema.

2. **Fragment** — create `apps/website/src/components/sections/<name>/<name>.graphql`:
   - `fragment <PascalName> on <StrapiType> { documentId ... }`
   - Compose shared fragments from `apps/website/src/components/ui/` where needed (`...Button`, `...Icon`, etc.)

3. **Component** — create `apps/website/src/components/sections/<name>/<name>.tsx`:
   - Import fragment type from `@/generated/graphql`
   - Wrap editable Strapi nodes with `StrapiEntry` / `StrapiEntryField` from `@/components/strapi`
   - Use `RichText` from `@/components/ui/rich-text-viewer` for blocks fields
   - Tailwind classes matching existing sections

4. **Barrel** — create `apps/website/src/components/sections/<name>/index.ts` exporting the component

5. **Wire PageSection** — update `apps/website/src/components/sections/page-section.tsx`:
   - Add fragment type to `PageSectionData` union
   - Add `case "<StrapiType>":` to the switch

6. **Page query** — add relation field + fragment under `section_refs` in `apps/website/src/app/page.graphql` (or the page that owns the section):
   ```graphql
   <relation_field> {
     __typename
     ...<PascalName>
   }
   ```

7. **Flatten refs** — add the new relation field to `apps/website/src/helpers/flatten-section-refs.ts`

8. **Codegen** — run `npm run codegen` (requires Strapi running with `STRAPI_API_TOKEN` in `.env.local`)

9. **Verify** — `npm run lint`; confirm types resolve and section renders

Report files created/changed. Note if Strapi content must be created manually in Strapi admin (Content Manager).
