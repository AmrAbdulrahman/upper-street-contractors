# Add UI component

Scaffold a reusable UI component under `src/components/ui/`.

Read `docs/agents/project-stack.md`. Use caveman mode. Match existing patterns in `src/components/ui/button/` and `src/components/ui/icon/`.

## Gather from user

- Component name (PascalCase)
- Whether it maps to a Contentful type (needs `.graphql` fragment)
- Props / variants needed

## Steps

1. **Folder** — `src/components/ui/<kebab-name>/`

2. **Component** — `<kebab-name>.tsx`:
   - Named export (or default + re-export — match siblings)
   - Tailwind utilities; use design tokens from `globals.css` (`bg-surface`, `text-foreground`, etc.)
   - TypeScript props interface

3. **GraphQL** (if Contentful-backed) — `<kebab-name>.graphql`:
   - Fragment on Contentful type with `_id`, `__typename`, `sys { id }`
   - Compose child fragments (`...Icon`, etc.) as needed

4. **Barrel** — `index.ts` re-exporting public API

5. **Codegen** (if `.graphql` added) — `npm run codegen`

6. **Verify** — `npm run lint`

Do not edit `src/generated/` by hand. Report files created.
