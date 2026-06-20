@AGENTS.md

## Agent skills

### Issue tracker

GitHub Issues in this repo (`gh` CLI). See `docs/agents/issue-tracker.md`.

### Triage labels

Default mattpocock/skills vocabulary (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context — `CONTEXT.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.

### Communication

**Always use caveman mode** — read `.agents/skills/caveman/SKILL.md` every session. Terse, high-signal responses. Off only when user says "stop caveman" or "normal mode". Invoke via `/caveman`.

### Planning

**Grill plans before non-trivial work** — features, refactors, architecture changes: run `grill-with-docs` first (`.agents/skills/grill-with-docs/SKILL.md`). Stress-test against `CONTEXT.md`, sharpen terminology, update glossary inline. Invoke via `/grill-me`.

### Verification

**Verify in browser before done** — read `.agents/skills/verify-with-devtools/SKILL.md` every session. After UI/frontend/runtime changes, run Chrome DevTools MCP checklist (`user-chrome-devtools`) before reporting complete. See `docs/agents/verification.md`. Invoke via `/verify-app`.

### Project stack

Next.js 16 + Strapi + Apollo + colocated GraphQL. See `docs/agents/project-stack.md`. Use stack-specific slash commands in `.cursor/commands/` (Cursor) or `.claude/commands/` (Claude CLI).

### Claude CLI parity

Run `npm run sync:claude-cli` after changing skills, commands, or MCP config. This syncs:

- `.agents/skills/` → `.claude/skills/`
- `.cursor/commands/` → `.claude/commands/`
- `~/.cursor/mcp.json` → `.mcp.json` (plus GitKraken if `gk` CLI is installed)

User-level Cursor skills (`~/.cursor/skills-cursor/`) sync to `~/.claude/skills/cursor-*` with the same command.

### Quality standards

**SEO = 100, full a11y, fully responsive** — non-negotiable on every UI task. See `docs/agents/quality-standards.md`.
