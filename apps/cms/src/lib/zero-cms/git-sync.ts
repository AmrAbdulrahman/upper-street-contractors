import "server-only";

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { resolve } from "node:path";
import type { EngineAdapter } from "@usc/zero-cms-core/node";

const execFileAsync = promisify(execFile);

// apps/cms -> repo root. Runtime cwd for `next start`/`next dev` under Nx is
// the project root (apps/cms), per project.json.
const REPO_ROOT = resolve(process.cwd(), "../..");

const DEBOUNCE_MS = 4_000;
const MAX_PUSH_RETRIES = 5;

/**
 * Ops that change what a fresh `main` checkout renders (ADR 0006: publish/unpublish
 * flip `__status`/live `values`; delete removes an entry outright; schema and media
 * have no draft overlay at all, so any write to them is immediately "live"). Everything
 * else (create/update/patch/discardDraft) only touches the `__draft` overlay or an
 * unpublished entry — invisible to production until one of these runs, so it doesn't
 * need to land in git yet. Durability for that draft churn is the persistent volume,
 * not git; git is the published-history/audit/rollback layer, not the primary store.
 */
const SYNC_TRIGGERS = [
  "publish",
  "unpublish",
  "delete",
  "saveSchema",
  "putMedia",
  "deleteMedia",
] as const;

type TriggerOp = (typeof SYNC_TRIGGERS)[number];

const state = {
  timer: null as ReturnType<typeof setTimeout> | null,
  flushing: null as Promise<void> | null,
  lastError: null as string | null,
  lastSyncedAt: null as string | null,
};

async function git(args: string[]): Promise<string> {
  const { stdout } = await execFileAsync("git", args, { cwd: REPO_ROOT });
  return stdout.trim();
}

async function flush(): Promise<void> {
  // Commit attribution: this only ever runs as a generic bot commit — threading the
  // specific triggering Editor through requires request-scoped context past the
  // adapter boundary (auth resolves inside createRequestHandler, above this wrapper).
  // Left as a known follow-up rather than reaching into core for it.
  await git(["add", "zero-cms-store/"]);
  const staged = await git(["diff", "--cached", "--name-only"]);
  if (!staged) return; // nothing actually changed on disk

  await git([
    "-c",
    "user.name=zero-cms-bot",
    "-c",
    "user.email=zero-cms-bot@users.noreply.github.com",
    "commit",
    "-m",
    "content: publish (zero-cms auto-sync)",
  ]);

  for (let attempt = 0; attempt < MAX_PUSH_RETRIES; attempt++) {
    try {
      await git(["push", "origin", "HEAD:main"]);
      state.lastError = null;
      state.lastSyncedAt = new Date().toISOString();
      return;
    } catch (err) {
      // Someone else (a dev's PR) landed on main between our commit and push.
      // Content and app-code changes are disjoint files, so this should be rare
      // and conflict-free — rebase and retry.
      try {
        await git(["fetch", "origin", "main"]);
        await git(["rebase", "origin/main"]);
      } catch (rebaseErr) {
        state.lastError = rebaseErr instanceof Error ? rebaseErr.message : String(rebaseErr);
        throw rebaseErr;
      }
      if (attempt === MAX_PUSH_RETRIES - 1) {
        state.lastError = err instanceof Error ? err.message : String(err);
        throw err;
      }
    }
  }
}

function schedule(): void {
  if (state.timer) clearTimeout(state.timer);
  state.timer = setTimeout(() => {
    state.timer = null;
    state.flushing = flush()
      .catch((err) => {
        // The publish already succeeded on local disk — this only means it hasn't
        // reached `main` yet. Surfaced via syncStatus() for the admin UI to poll.
        console.error("[git-sync] push failed:", err);
      })
      .finally(() => {
        state.flushing = null;
      });
  }, DEBOUNCE_MS);
}

export function syncStatus(): {
  enabled: boolean;
  pending: boolean;
  lastError: string | null;
  lastSyncedAt: string | null;
} {
  return {
    enabled: process.env.ZERO_CMS_GIT_SYNC === "true",
    pending: state.timer !== null || state.flushing !== null,
    lastError: state.lastError,
    lastSyncedAt: state.lastSyncedAt,
  };
}

/** Run once at boot, before serving traffic. No-op unless git-sync is enabled. */
export async function pullOnBoot(): Promise<void> {
  if (process.env.ZERO_CMS_GIT_SYNC !== "true") return;
  try {
    await git(["pull", "--ff-only", "origin", "main"]);
  } catch (err) {
    console.error("[git-sync] boot pull failed — starting with whatever is on disk:", err);
  }
}

/**
 * Wrap an adapter so publish-affecting ops (SYNC_TRIGGERS) schedule a debounced
 * commit+push to `main`. Everything else passes through untouched. Returns the
 * adapter unchanged when `ZERO_CMS_GIT_SYNC` isn't `"true"` — off by default so
 * local dev (and any deploy until explicitly enabled) never auto-pushes.
 */
export function withGitSync(adapter: EngineAdapter): EngineAdapter {
  if (process.env.ZERO_CMS_GIT_SYNC !== "true") return adapter;

  const wrapped = { ...adapter };
  for (const op of SYNC_TRIGGERS) {
    const original = adapter[op].bind(adapter) as (...args: unknown[]) => Promise<unknown>;
    (wrapped[op] as (...args: unknown[]) => Promise<unknown>) = async (...args: unknown[]) => {
      const result = await original(...args);
      schedule();
      return result;
    };
  }
  return wrapped;
}

export type { TriggerOp };
