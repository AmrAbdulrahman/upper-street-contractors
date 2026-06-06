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

Next.js 16 + Contentful + Apollo + colocated GraphQL. See `docs/agents/project-stack.md`. Use stack-specific slash commands in `.cursor/commands/`.
