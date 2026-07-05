import "server-only";

import {
  createFsStoragePort,
  createNodeAdapter,
  loadConfig,
  type EngineAdapter,
} from "@usc/zero-cms-core/node";
import { createHttpAdapter, type Adapter } from "@usc/zero-cms-core";

/**
 * Two adapter modes, chosen by `ZERO_CMS_REMOTE_URL`:
 *
 * - **unset** -> local `nodeFsAdapter`, reading `zero-cms-store/` directly off disk.
 *   This is only ever actually exercised at **build time**, on the production
 *   (static export) build — production ships no server at runtime to call it from.
 * - **set** -> `httpAdapter` against cms (staging: live, every request, no
 *   cache — see `lib/cms/query.ts`). Server-to-server, not a browser call, so no
 *   CORS involved. Auth is a dedicated **viewer-role service account** on cms
 *   (`ZERO_CMS_SERVICE_EMAIL`/`ZERO_CMS_SERVICE_PASSWORD`), never an Editor's own
 *   login — logged in once per warm process and cached until near expiry.
 *
 * cms itself owns the RPC/auth/media/graphql/admin surface now (this app no
 * longer serves any of that) — see root README -> Architecture.
 */
type Cache = {
  local?: Promise<EngineAdapter>;
  remote?: { adapter: Adapter; expiresAtMs: number };
};

const g = globalThis as typeof globalThis & { __zeroCmsWebsite?: Cache };
g.__zeroCmsWebsite ??= {};

/** Decode a JWT's `exp` (seconds) without verifying — we trust our own login response. */
function decodeExpiryMs(token: string): number {
  try {
    const body = token.split(".")[1];
    const { exp } = JSON.parse(Buffer.from(body, "base64url").toString()) as {
      exp: number;
    };
    return exp * 1000;
  } catch {
    return Date.now() + 60_000; // conservative if the token shape ever changes
  }
}

async function loginService(remoteUrl: string): Promise<{ token: string; expiresAtMs: number }> {
  const email = process.env.ZERO_CMS_SERVICE_EMAIL;
  const password = process.env.ZERO_CMS_SERVICE_PASSWORD;
  if (!email || !password) {
    throw new Error(
      "website: ZERO_CMS_SERVICE_EMAIL / ZERO_CMS_SERVICE_PASSWORD are required " +
        "when ZERO_CMS_REMOTE_URL is set — create a dedicated viewer-role account " +
        "on cms for this, not an Editor's own login."
    );
  }
  const res = await fetch(`${remoteUrl.replace(/\/$/, "")}/api/cms/auth`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ op: "login", args: [email, password] }),
  });
  if (!res.ok) {
    throw new Error(`website: zero-cms service login failed (${res.status})`);
  }
  const { token } = (await res.json()) as { token: string };
  return { token, expiresAtMs: decodeExpiryMs(token) };
}

async function getRemoteAdapter(remoteUrl: string): Promise<Adapter> {
  const cached = g.__zeroCmsWebsite!.remote;
  // Refresh 5 minutes ahead of expiry rather than waiting for a 401 mid-request.
  if (cached && cached.expiresAtMs - Date.now() > 5 * 60_000) return cached.adapter;

  const { token, expiresAtMs } = await loginService(remoteUrl);
  const adapter = createHttpAdapter({
    baseUrl: remoteUrl,
    headers: { Authorization: `Bearer ${token}` },
  });
  g.__zeroCmsWebsite!.remote = { adapter, expiresAtMs };
  return adapter;
}

async function getLocalAdapter(): Promise<EngineAdapter> {
  return (g.__zeroCmsWebsite!.local ??= (async () => {
    const config = await loadConfig();
    const port = createFsStoragePort(config);
    return createNodeAdapter(port);
  })());
}

export async function getZeroCmsAdapter(): Promise<Adapter> {
  const remoteUrl = process.env.ZERO_CMS_REMOTE_URL;
  return remoteUrl ? getRemoteAdapter(remoteUrl) : getLocalAdapter();
}
