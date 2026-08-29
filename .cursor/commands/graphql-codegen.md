# GraphQL codegen

Regenerate types after `.graphql` file changes.

Read `docs/agents/project-stack.md`. Use caveman mode.

## Steps

1. Run `nx codegen website` — it depends on the `cms-schema` target, so the SDL is rebuilt
   first. Both read the schema from **live Redis** (ADR 0008); no server needs to be running
   and there is no local store to point at.

   After a **schema** change (a seed script or the Types tab), add `--skip-nx-cache`:

   ```
   nx cms-schema website --skip-nx-cache && nx codegen website --skip-nx-cache
   ```

   Nx caches `cms-schema`, and a cached run silently regenerates the OLD SDL.

2. Verify output updated:
   - `apps/website/src/generated/graphql.ts` — types + typed document nodes
   - `apps/website/src/generated/schema.graphql` — schema printed from zero-cms, not a
     remote server

3. Fix any codegen errors (missing fragments, schema drift, typos in `.graphql` files)

4. Typecheck with `npx tsc --noEmit -p apps/website/tsconfig.json` — the lib lint target is
   unreliable, and codegen happily emits types no call site matches.

5. If the schema changed, **restart `next dev`** — it caches the schema once per process.

Report what changed. If codegen fails, show error and which `.graphql` file likely caused it.
