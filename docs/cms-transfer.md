# CMS data transfer (`cms:push` / `cms:pull`)

How content and configuration move between your **local** Strapi (`apps/cms`, SQLite at
`apps/cms/.tmp/data.db`) and **Strapi Cloud**.

```bash
npm run cms:push    # LOCAL  → CLOUD   (overwrites the cloud)
npm run cms:pull    # CLOUD  → LOCAL   (overwrites your local)
```

Both wrap Strapi's built-in `strapi transfer` (`scripts/strapi-transfer.mjs`). Required env in
`.env.local`:

- `STRAPI_CLOUD_URL` (or `STRAPI_URL`) — cloud base URL, no `/admin` suffix
- `STRAPI_TRANSFER_TOKEN` — a Strapi **Transfer token** (Settings → Transfer Tokens)

---

## What gets transferred

> [!IMPORTANT]
> This is a **full database mirror**, not a content-only sync. The script passes no
> `--only`/`--exclude` filters, so **everything below moves every time** — including admin
> accounts, roles, webhooks, and auth-provider config.

`strapi transfer` runs five stages: `entities`, `links`, `assets`, `schemas`, `configuration`.

| Data | Transferred? | Rides in | Underlying table / key |
| --- | --- | --- | --- |
| All content (`api::*` Projects, Reviews, Pages, …) | ✅ | entities + links | per content type |
| Media / uploads | ✅ | assets | `plugin::upload.file` / `folder` |
| **Admin panel users + roles** | ✅ | entities | `admin::user`, `admin::role`, `admin::permission` |
| **U&P roles** (+ users, permissions) | ✅ | entities | `plugin::users-permissions.role` / `user` / `permission` |
| **Webhooks** | ✅ | configuration | `strapi_webhooks` |
| **Auth providers** (Google/FB/etc. + email + advanced settings) | ✅ | configuration (core-store) | `plugin_users-permissions_grant`, `..._email`, `..._advanced` |
| API tokens / transfer tokens | ✅ | entities | `admin::api-token`, `admin::transfer-token` |

The entities stage streams **all** of `strapi.contentTypes` with no filter
(`@strapi/data-transfer` → `local-source/entities.js`); the configuration stage streams the whole
core-store plus webhooks (`local-source/configuration.js`). The destination **deletes and
recreates** every content type, model, core-store entry, and webhook
(`local-destination/strategies/restore/index.js`). A push to Strapi Cloud runs that same restore
logic on the cloud side.

### Not transferred

- **Content-type schemas / models.** The `schemas` stage only *compares* (strict strategy) — it
  does not migrate schema. **Local and cloud schemas must already match or the whole transfer
  aborts.** Keep schema in code and deploy it (git) before transferring data.
- **Config that lives in files/env, not the DB** — e.g. `apps/cms/config/*`, upload-provider and
  email-provider config, `APP_KEYS`, JWT secrets. Those ship via git + env, not data transfer.

---

## Footguns

> [!WARNING]
> Every transfer is **destructive and irreversible** on the target. `push` replaces the cloud with
> your local data; `pull` replaces your local with the cloud. There is no merge and no undo.

- **Admin lockout.** Because `admin::user` / `admin::role` are overwritten, after a `push` the
  cloud admin panel only accepts your **local** admin logins (and `pull` overwrites your local
  admins with the cloud's). If the source environment's admin accounts aren't ones you can log in
  with, you can lock yourself out of the target. Make sure you hold valid credentials for the
  **source** before transferring.
- **Webhooks get wiped to match the source.** Local `strapi_webhooks` is currently empty, so a
  `push` **deletes all webhooks configured in the cloud**. Define webhooks on the source side first
  if you want to keep them.
- **Provider secrets travel.** OAuth client IDs/secrets live in core-store and are copied verbatim.
  That moves secrets between environments and can carry env-specific callback URLs into the wrong
  environment. Re-check provider config after a transfer.
- **Transfer/API tokens are replaced too.** After a transfer the target's tokens reflect the
  source. If `STRAPI_TRANSFER_TOKEN` pointed at a token that gets overwritten, re-verify it before
  the next run.
- **Schema mismatch aborts everything.** Differing plugin versions or EE-only features between
  local and cloud will fail the `schemas` comparison and stop the transfer before any data moves.

---

## Scoping a transfer down (if ever needed)

The wrapper currently transfers everything. The underlying CLI supports **group-level** filters via
`--only` / `--exclude`, where the groups are `content` (entities + links), `files` (assets), and
`config` (configuration = core-store + webhooks):

```bash
# config only — webhooks + providers + plugin settings, no content or media:
strapi transfer --only config --from <url>/admin --from-token <token>
```

Note the granularity is **coarse**: you cannot exclude just admin users via the CLI — `admin::*`
and `plugin::users-permissions.*` are part of the `content`/entities group. Per-content-type
exclusion is only available through the programmatic restore options (`restore.entities.exclude`),
not the CLI flags. If a true "settings-only, leave content alone" sync is ever required, it needs a
custom script (programmatic transfer engine, or admin REST API), not just a flag.
