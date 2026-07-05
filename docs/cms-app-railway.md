# Deploying cms-app to Railway

`apps/cms-app` is the sole network-reachable writer for zero-cms (ADR 0003/0004:
single-writer, pluggable adapter). This is a runbook for the manual/infra parts —
nothing here can be done from a coding session, it needs your actual Railway
account, GitHub repo settings, and secrets.

See root [`README.md`](../README.md) → Architecture for the system diagram this
implements.

## Why not a slim container image

`apps/cms-app/next.config.mjs` deliberately does **not** set `output: "standalone"`.
The git-sync module (`apps/cms-app/src/lib/zero-cms/git-sync.ts`) needs a real `.git`
working tree with push access **at runtime**, not just at build time — a typical
multi-stage Docker build that copies only `.next/standalone` into a slim runtime
image would leave `.git` behind and git-sync would have nothing to push from.

Deploy this as: a persistent volume holding an actual git clone of the repo, with
`npm ci && npx nx build cms-app` and `npx nx start cms-app` run **in place** inside
that clone — not copied out to another image afterward.

## Railway service setup

1. New service, **Root Directory**: repo root (the whole Nx workspace — `nx build`
   needs it, not just `apps/cms-app`).
2. **Build command**: `npm ci && npx nx build cms-app`
3. **Start command**: `npx nx start cms-app` (runs `next start -p 3001` in place —
   see `apps/cms-app/project.json`)
4. **Persistent volume**: mount over the repo's working directory (or at minimum
   over `.zero-cms-store/` + the `.git` dir — simplest is the whole checkout).
5. **Replicas: pin to 1.** Do not autoscale — zero-cms-core assumes a single writer
   process (ADR 0003). More than one replica means two processes racing on the same
   `data.json`/git remote.
6. **Serverless / sleep-on-idle: leave OFF.** Railway's default for a
   Docker/Nixpacks service is already always-on; just don't opt into the
   "Serverless" toggle (it sleeps after 10min idle, which would drop long-running
   Editor sessions and pause git-sync).
7. **Health check**: `GET /healthz` — deliberately doesn't touch the adapter/store,
   so it stays fast and won't false-negative during a git-sync push.
8. **Spend cap**: set a hard limit (Hobby minimum $10) so a runaway loop can't
   surprise-bill.

## Secrets (Railway service env vars)

| Var | Value |
| --- | --- |
| `ZERO_CMS_AUTH_SECRET` | Long random string. Required — cms-app refuses to boot without it (see `src/lib/zero-cms/server.ts`). |
| `ZERO_CMS_ADMIN_EMAIL` / `ZERO_CMS_ADMIN_PASSWORD` | First-admin seed, only used once (when `users.json` is empty). |
| `ZERO_CMS_ALLOWED_ORIGINS` | Comma-separated exact origins allowed to call the RPC/auth/media/graphql endpoints from a browser — the staging website's origin, and the production origin only if it ever needs Inspect mode (it currently doesn't — see open item below). |
| `ZERO_CMS_GIT_SYNC` | `true` to enable auto-commit+push on publish. **Test against a throwaway branch/repo first** — see below. |

Do **not** put any of these in Vercel — they belong solely to the process that
actually writes to disk.

## git-sync credentials (the part that isn't code)

`git-sync.ts` runs plain `git push origin HEAD:main` — it relies on the checkout's
`origin` remote already being able to push non-interactively. Set this up once on
the Railway volume's clone:

1. Create a **fine-grained GitHub PAT** (or GitHub App installation token) scoped to
   **this repo only**, permissions: **Contents: read/write**, **Metadata: read**.
   Nothing else — no admin, no workflows, no other repos.
2. Set the `origin` remote to embed it, or configure a credential helper — either
   works, pick one and document which for whoever re-provisions this:
   ```bash
   git remote set-url origin https://x-access-token:<TOKEN>@github.com/<org>/<repo>.git
   ```
3. Set a bot git identity (git-sync's commits already pass `-c user.name=zero-cms-bot
   -c user.email=zero-cms-bot@users.noreply.github.com` per-commit, so this is
   mostly for clarity in `git log`, not strictly required globally).
4. **Branch protection on `main`**: this bot pushes directly to `main` (see root
   README → the two-branch build discussion — production's static build only
   depends on `main`, so this is the simplest path with no merge/deploy-hook
   plumbing). If `main` requires PR review, add an actor-bypass rule for this
   token's identity, otherwise every push from cms-app will be rejected.

**Test git-sync against a throwaway repo/branch before pointing it at the real
`main`.** Flip `ZERO_CMS_GIT_SYNC=true` in a scratch environment first, publish a
test entry, confirm the commit + push behave as expected (correct diff, rebase-retry
on a simulated push conflict), before enabling it anywhere near production content.

## Website (Vercel) side

Staging environment only — production doesn't talk to cms-app at all (static
export, build-time local-fs read):

| Var | Value |
| --- | --- |
| `ZERO_CMS_REMOTE_URL` | cms-app's Railway URL, e.g. `https://cms-app-staging.up.railway.app` |
| `NEXT_PUBLIC_ZERO_CMS_URL` | same URL — this one reaches the browser (Inspect overlay), the other is server-to-server |
| `ZERO_CMS_SERVICE_EMAIL` / `ZERO_CMS_SERVICE_PASSWORD` | A dedicated **viewer-role** account on cms-app — create it once via `https://<cms-app-url>/admin` (log in as the seeded admin, create a new user with role `viewer`). Never reuse an Editor's own login for this — it's a server-to-server credential, not a session. |

## Known open item: production static export

Production (`main`, meant to build as `output: "export"`) is **not yet flipped** —
confirmed by an actual build attempt that failed:

```
Error: export const dynamic = "force-dynamic" on page "/api/dev/cms-calls"
cannot be used with "output: export"
```

`apps/website` still has several pre-existing, unrelated dynamic routes from the
Strapi era (`/api/auth/*`, `/api/graphql`, `/api/revalidate`, `/api/strapi-health`,
`/api/dev/cms-calls`) that also need auditing/removing/relocating before static
export can build at all. That's a separate scoping exercise, not part of the
zero-cms remote-editing migration — production currently still runs as a normal
Next server (unaffected by any of the above; it simply never talks to cms-app).
