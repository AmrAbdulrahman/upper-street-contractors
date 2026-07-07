# Add UI component

Scaffold a reusable UI component under `apps/website/src/components/ui/`.

Read `docs/agents/project-stack.md`. Use caveman mode. Match existing patterns in `apps/website/src/components/ui/button/` and `apps/website/src/components/ui/icon/`.

## Gather from user

- Component name (PascalCase)
- Whether it maps to a zero-cms Type (needs `.graphql` fragment)
- Props / variants needed

## Steps

1. **Folder** — `apps/website/src/components/ui/<kebab-name>/`

2. **Component** — `<kebab-name>.tsx`:
   - Named export (or default + re-export — match siblings)
   - Tailwind utilities; use design tokens from `globals.css` (`bg-surface`, `text-foreground`, etc.)
   - TypeScript props interface

3. **GraphQL** (if zero-cms-backed) — `<kebab-name>.graphql`:
   - Fragment on the zero-cms Type
   - Compose child fragments (`...Icon`, etc.) as needed

4. **Barrel** — `index.ts` re-exporting public API

5. **Codegen** (if `.graphql` added) — `npm run codegen`

6. **Verify** — `npm run lint`

Do not edit `apps/website/src/generated/` by hand. Report files created.
