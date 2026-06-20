---
name: verify-with-devtools
description: >
  Browser verification via Chrome DevTools MCP after implementation work.
  Read every session. Run checklist before marking UI/frontend tasks done.
  Use when finishing features, fixes, refactors, or any change that should
  render or run in the browser. Invoke via /verify-app.
---

# Verify with Chrome DevTools

MCP server:
- **Cursor**: `user-chrome-devtools` — read tool schemas in `mcps/user-chrome-devtools/tools/` before `CallMcpTool`.
- **Claude CLI**: `chrome-devtools` — use MCP tools directly (no `mcps/` folder).

Default app URL: `http://localhost:3000` (Next.js dev). Override when task targets another route.

## When to run

**Required** before reporting done on tasks that change runtime behavior, UI, routing, GraphQL client usage, or styles.

**Skip** only when:
- Read-only question or code review (no edits)
- Docs/config with zero app impact
- User says "skip verify" or "no browser check"

## Preconditions

1. Dev server up: `npm run dev` (or confirm already running in terminals).
2. Build/lint already green when task touched those paths.

## Checklist

Run in order. Stop and fix on first hard failure unless user asked to report only.

| Step | MCP tool | Pass criteria |
| ---- | -------- | ------------- |
| 1 | `list_pages` → `navigate_page` (type `url`) | Page loads (no blank/error shell) |
| 2 | `take_snapshot` | Expected content/structure present; note missing sections |
| 3 | `list_console_messages` (types `error`, `warn`) | No errors; warnings only if pre-existing or explained |
| 4 | `list_network_requests` | No failed fetches/XHR (4xx/5xx) for app/API calls |
| 5 | `take_screenshot` | Only when visual/layout change — attach for user review |

For route-specific work, navigate to affected path(s) and repeat steps 2–4.

## Reporting

Brief verify summary in final response:

```
Verify: PASS | FAIL
URL: …
Console: 0 errors, N warnings
Network: …
Snapshot: …
```

On FAIL: state what broke, what you tried, whether fix applied.

## Common fixes

- **Connection refused** → start `npm run dev`
- **GraphQL errors** → check `.env.local`, run `npm run codegen` if schema changed
- **Hydration mismatch** → inspect console message, fix server/client divergence
- **Stale bundle** → `navigate_page` type `reload` with `ignoreCache: true`

## Interaction testing

Use `click`, `fill`, `type_text`, `hover` only when task requires user flows. Prefer `take_snapshot` over screenshot for assertions.
