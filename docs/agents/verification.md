# Browser verification

Agents verify the running app with **Chrome DevTools MCP** (`user-chrome-devtools`) after implementation work.

## Skill

`.agents/skills/verify-with-devtools/SKILL.md` — read every session. Mandatory before marking UI/frontend tasks done.

Slash command: `/verify-app`

## MCP setup

Chrome DevTools MCP must be enabled in Cursor (user-level MCP config). Tool descriptors live under the workspace `mcps/user-chrome-devtools/tools/` folder when the server is connected.

Agents call tools via `CallMcpTool` with `server: "user-chrome-devtools"`. Always read the tool JSON schema before calling.

## Default target

| Mode | URL |
| ---- | --- |
| Local dev | `http://localhost:3000` |
| Production build smoke | `npm run build && npm run start` → same port unless overridden |

## What gets checked

1. Page navigation and load
2. Accessibility snapshot (content/structure)
3. Console errors and warnings
4. Failed network requests (especially GraphQL via `/api/graphql`)

Skip verification for read-only Q&A, docs-only edits, or when the user opts out.
