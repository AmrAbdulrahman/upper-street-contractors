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

/**
 * One Engine-backed adapter + Auth per server process (single-writer model), built
 * from `zero-cms.config.mjs` and sharing one StoragePort. Cached on `globalThis` so
 * Next dev HMR doesn't spawn duplicate writers.
 *
 * Auth is enabled only when `ZERO_CMS_AUTH_SECRET` is set; the first admin is seeded
 * from `ZERO_CMS_ADMIN_EMAIL` / `ZERO_CMS_ADMIN_PASSWORD` when the store is empty.
 */
type Cache = {
  init?: Promise<{ adapter: EngineAdapter; auth?: Auth }>;
  handler?: (req: Request) => Promise<Response>;
  authHandler?: (req: Request) => Promise<Response>;
};

const g = globalThis as typeof globalThis & { __zeroCms?: Cache };
g.__zeroCms ??= {};

function init() {
  return (g.__zeroCms!.init ??= (async () => {
    const config = await loadConfig();
    const port = createFsStoragePort(config);
    const adapter = await createNodeAdapter(port);

    let auth: Auth | undefined;
    const secret = process.env.ZERO_CMS_AUTH_SECRET;
    if (secret) {
      auth = await Auth.load(port, { secret });
      await auth.seedFromEnv();
    }
    return { adapter, auth };
  })());
}

export async function getZeroCmsAdapter(): Promise<EngineAdapter> {
  return (await init()).adapter;
}

export async function getZeroCmsAuth(): Promise<Auth | undefined> {
  return (await init()).auth;
}

/** RPC handler — enforces a Bearer session + roles when auth is enabled. */
export async function getZeroCmsHandler(): Promise<(req: Request) => Promise<Response>> {
  if (g.__zeroCms!.handler) return g.__zeroCms!.handler;
  const { adapter, auth } = await init();
  return (g.__zeroCms!.handler = createRequestHandler(adapter, { auth }));
}

/** Auth handler (login / me / changePassword / user admin). Null when auth is off. */
export async function getZeroCmsAuthHandler(): Promise<
  ((req: Request) => Promise<Response>) | null
> {
  if (g.__zeroCms!.authHandler) return g.__zeroCms!.authHandler;
  const { auth } = await init();
  if (!auth) return null;
  return (g.__zeroCms!.authHandler = createAuthHandler(auth));
}
