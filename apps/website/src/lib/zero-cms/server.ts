import "server-only";

import { revalidatePath, revalidateTag } from "next/cache";
import { after } from "next/server";
import {
  Auth,
  createRedisAdapter,
  createRedisStoragePort,
  createRequestHandler,
  createAuthHandler,
  type EngineAdapter,
} from "@usc/zero-cms-core/node";
import { ZERO_CMS_CACHE_TAG } from "@/lib/cms/cache-tag";
import { getAllSitePaths } from "@/lib/cms/site-routes";

/**
 * Wraps the write adapter so any publish-affecting op (ADR 0010/0011: the same
 * set git-sync used to trigger a commit on, before Redis replaced git) also
 * revalidates the ISR cache — guaranteed at the RPC layer for every caller,
 * not dependent on any browser client remembering to revalidate afterward
 * (the editor's own view refreshes via a client-side `router.refresh()`).
 *
 * Two separate cache layers both need busting: `revalidatePath` for the
 * Full Route Cache (the rendered HTML/RSC per page), and `revalidateTag` for
 * the `unstable_cache`'d CMS reads inside `query.ts` (Next's Data Cache,
 * which `revalidatePath` doesn't reliably reach on its own since our reads
 * don't go through `fetch()` directly).
 */
const REVALIDATE_TRIGGERS = new Set([
  "publish",
  "unpublish",
  "delete",
  "saveSchema",
  "putMedia",
  "deleteMedia",
] as const);

/**
 * ADR 0012: purging isn't enough on its own — the *next* visitor to any
 * invalidated route pays a synchronous full render, and since invalidation
 * above is whole-site (ADR 0010), that cost lands on every route, not just
 * the one entry that changed. This warms the Full Route Cache back up right
 * after the purge instead of waiting for organic traffic to trigger it.
 *
 * Runs via `after()`, not a bare un-awaited fetch: Vercel can freeze the
 * function's execution environment the instant the RPC response is sent, and
 * a plain fire-and-forget promise can get killed mid-flight — `after()` is
 * the supported way to keep the invocation alive for trailing background
 * work like this.
 *
 * Self-fetches use `VERCEL_URL` (set on every Vercel deployment, preview and
 * prod) as the origin, falling back to localhost for local dev — where this
 * is a no-op in effect anyway, since dev mode doesn't cache renders the same
 * way, but it keeps the code path uniform across environments.
 */
function warmSiteCache(): void {
  after(async () => {
    const origin = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : `http://localhost:${process.env.PORT ?? 3000}`;
    const paths = await getAllSitePaths();
    // /sitemap.xml isn't part of the crawlable-page list (it describes those
    // pages, it isn't one), so it's warmed explicitly alongside them.
    await Promise.allSettled(
      [...paths, "/sitemap.xml"].map((path) =>
        fetch(`${origin}${path}`, { cache: "no-store" })
      )
    );
  });
}

function withRevalidate(adapter: EngineAdapter): EngineAdapter {
  const wrapped = { ...adapter };
  for (const op of REVALIDATE_TRIGGERS) {
    const original = adapter[op].bind(adapter) as (...args: unknown[]) => Promise<unknown>;
    (wrapped[op] as (...args: unknown[]) => Promise<unknown>) = async (...args: unknown[]) => {
      const result = await original(...args);
      // { expire: 0 }, not the recommended `"max"` profile: publish is meant
      // to reflect immediately (ADR 0010), not on a stale-while-revalidate
      // delay until some later visit happens to re-trigger it.
      revalidateTag(ZERO_CMS_CACHE_TAG, { expire: 0 });
      revalidatePath("/", "layout");
      warmSiteCache();
      return result;
    };
  }
  return wrapped;
}

/**
 * cms merged back into website (ISR gave production a real server again —
 * the reasons for a separate static-export-safe app are gone). Two adapters,
 * both Redis+Blob (ADR 0008), split by credential, not by environment:
 *
 * - **read-only token** — every page render, public *and* the /admin-mirrored
 *   preview routes (proxy.ts rewrites those to the same (site) pages). Page
 *   rendering never writes, so it never needs write-capable credentials, even
 *   in preview — defense in depth, not just convention.
 * - **read-write token** — only the auth-gated RPC surface (/zero-cms/rpc,
 *   /api/cms/auth) ever touches this. The real security boundary is the RPC
 *   handler's own session check (ADR 0009), the token split is a second layer.
 *
 * Same origin now, so no CORS, no service-account login dance, no remote-URL
 * branching — one process, one place these live.
 */
type Cache = {
  readOnly?: Promise<EngineAdapter>;
  readWrite?: Promise<EngineAdapter>;
  auth?: Promise<Auth>;
  handler?: (req: Request) => Promise<Response>;
  authHandler?: (req: Request) => Promise<Response>;
};

const g = globalThis as typeof globalThis & { __zeroCms?: Cache };
g.__zeroCms ??= {};

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`website: ${name} is required`);
  return v;
}

function blobOpts() {
  return { token: requireEnv("BLOB_READ_WRITE_TOKEN") };
}

/** Public + admin-preview page rendering. Never mutates — read-only token. */
export async function getZeroCmsReadAdapter(): Promise<EngineAdapter> {
  return (g.__zeroCms!.readOnly ??= createRedisAdapter(
    {
      url: requireEnv("STORAGE_KV_REST_API_URL"),
      token: requireEnv("STORAGE_KV_REST_API_READ_ONLY_TOKEN"),
    },
    blobOpts()
  ));
}

/** The RPC surface only. Auth-gated (createRequestHandler + Auth), read-write token. */
async function getZeroCmsWriteAdapter(): Promise<EngineAdapter> {
  return (g.__zeroCms!.readWrite ??= createRedisAdapter(
    {
      url: requireEnv("STORAGE_KV_REST_API_URL"),
      token: requireEnv("STORAGE_KV_REST_API_TOKEN"),
    },
    blobOpts()
  ));
}

export async function getZeroCmsAuth(): Promise<Auth> {
  return (g.__zeroCms!.auth ??= (async () => {
    const secret = requireEnv("ZERO_CMS_AUTH_SECRET");
    const port = createRedisStoragePort({
      url: requireEnv("STORAGE_KV_REST_API_URL"),
      token: requireEnv("STORAGE_KV_REST_API_TOKEN"),
    });
    const auth = await Auth.load(port, { secret });
    await auth.seedFromEnv();
    return auth;
  })());
}

/** RPC handler — enforces a Bearer session + roles (always on, no dev bypass here). */
export async function getZeroCmsHandler(): Promise<(req: Request) => Promise<Response>> {
  if (g.__zeroCms!.handler) return g.__zeroCms!.handler;
  const [adapter, auth] = await Promise.all([getZeroCmsWriteAdapter(), getZeroCmsAuth()]);
  return (g.__zeroCms!.handler = createRequestHandler(withRevalidate(adapter), { auth }));
}

/** Auth handler (login / me / changePassword / user admin). */
export async function getZeroCmsAuthHandler(): Promise<(req: Request) => Promise<Response>> {
  if (g.__zeroCms!.authHandler) return g.__zeroCms!.authHandler;
  const auth = await getZeroCmsAuth();
  return (g.__zeroCms!.authHandler = createAuthHandler(auth));
}
