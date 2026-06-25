import { getStrapiAuthHeaders } from "@/lib/strapi-auth";
import { getRefreshToken, refreshAccessToken } from "@/lib/auth/session";
import { recordCmsCall } from "@/lib/dev/cms-call-collector";

const isDev = process.env.NODE_ENV === "development";

/**
 * Server-side fetch to Strapi that injects the current auth header (editor JWT,
 * else the read-only service token) and, on a 401 with an active editor session,
 * refreshes the access token once and replays the request. Only safe in Route
 * Handlers / Server Actions (refresh writes cookies).
 */
export async function strapiFetch(
  input: string | URL,
  init: RequestInit = {},
): Promise<Response> {
  const authHeaders = await getStrapiAuthHeaders();
  const started = isDev ? Date.now() : 0;
  const res = await fetch(input, {
    ...init,
    headers: { ...init.headers, ...authHeaders },
  });

  // Only retry when we have a session to refresh — anonymous read-token traffic
  // that 401s should surface as-is.
  if (res.status !== 401 || !(await getRefreshToken())) {
    recordRest(input, init, res, started);
    return res;
  }

  const newAccess = await refreshAccessToken();
  if (!newAccess) {
    recordRest(input, init, res, started);
    return res;
  }

  const retried = await fetch(input, {
    ...init,
    headers: { ...init.headers, Authorization: `Bearer ${newAccess}` },
  });
  recordRest(input, init, retried, started);
  return retried;
}

function recordRest(
  input: string | URL,
  init: RequestInit,
  res: Response,
  started: number,
): void {
  if (!isDev) return;
  const url = typeof input === "string" ? input : input.toString();
  let path = url;
  try {
    path = new URL(url).pathname;
  } catch {
    // keep the raw input if it isn't an absolute URL
  }
  recordCmsCall({
    kind: "rest",
    method: (init.method ?? "GET").toUpperCase(),
    path,
    status: String(res.status),
    network: true,
    ok: res.ok,
    durationMs: Date.now() - started,
  });
}
