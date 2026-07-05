import "server-only";

import {
  Auth,
  createAuthHandler,
  createFsStoragePort,
  createNodeAdapter,
  createRequestHandler,
  loadConfig,
  type EngineAdapter,
} from "@usc/zero-cms-core/node";
import { pullOnBoot, withGitSync } from "./git-sync";

/**
 * One Engine-backed adapter + Auth per server process (single-writer model), built
 * from `zero-cms.config.mjs` and sharing one StoragePort. Cached on `globalThis` so
 * Next dev HMR doesn't spawn duplicate writers.
 *
 * Unlike the old in-website wiring, auth is **mandatory** here, not gated behind an
 * optional env var — cms is the sole writer, reachable over the network (Railway),
 * so an unauthenticated RPC surface would mean anyone can write. Boot fails loudly if
 * `ZERO_CMS_AUTH_SECRET` is missing.
 */
type Cache = {
  init?: Promise<{ adapter: EngineAdapter; auth: Auth }>;
  handler?: (req: Request) => Promise<Response>;
  authHandler?: (req: Request) => Promise<Response>;
};

const g = globalThis as typeof globalThis & { __zeroCms?: Cache };
g.__zeroCms ??= {};

function init() {
  return (g.__zeroCms!.init ??= (async () => {
    await pullOnBoot();

    const config = await loadConfig();
    const port = createFsStoragePort(config);
    const adapter = withGitSync(await createNodeAdapter(port));

    const secret = process.env.ZERO_CMS_AUTH_SECRET;
    if (!secret) {
      throw new Error(
        "cms: ZERO_CMS_AUTH_SECRET is required — this deployment is the sole " +
          "network-reachable writer, it must never boot with auth disabled."
      );
    }
    const auth = await Auth.load(port, { secret });
    await auth.seedFromEnv();
    return { adapter, auth };
  })());
}

export async function getZeroCmsAdapter(): Promise<EngineAdapter> {
  return (await init()).adapter;
}

export async function getZeroCmsAuth(): Promise<Auth> {
  return (await init()).auth;
}

/** RPC handler — enforces a Bearer session + roles (auth always on here). */
export async function getZeroCmsHandler(): Promise<(req: Request) => Promise<Response>> {
  if (g.__zeroCms!.handler) return g.__zeroCms!.handler;
  const { adapter, auth } = await init();
  return (g.__zeroCms!.handler = createRequestHandler(adapter, { auth }));
}

/** Auth handler (login / me / changePassword / user admin). */
export async function getZeroCmsAuthHandler(): Promise<(req: Request) => Promise<Response>> {
  if (g.__zeroCms!.authHandler) return g.__zeroCms!.authHandler;
  const { auth } = await init();
  return (g.__zeroCms!.authHandler = createAuthHandler(auth));
}
