# Grill me

Read and follow `.agents/skills/grill-with-docs/SKILL.md`.

Before any implementation, grill the user's plan:

1. Read `CONTEXT.md` and relevant `docs/adr/` if they exist (proceed silently if missing).
2. Interview relentlessly — **one question at a time**, wait for answer before next.
3. Challenge terminology against the glossary; sharpen fuzzy language.
4. Cross-reference claims against the codebase.
5. Update `CONTEXT.md` inline as terms resolve (format: `.agents/skills/grill-with-docs/CONTEXT-FORMAT.md`).
6. Offer ADRs only when hard-to-reverse, surprising, and trade-off-driven (format: `.agents/skills/grill-with-docs/ADR-FORMAT.md`).

Use caveman mode (`.agents/skills/caveman/SKILL.md`) for all responses during this session.

Start by asking what plan or feature the user wants grilled.
