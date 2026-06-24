import { getStrapiAuthHeaders } from "@/lib/strapi-auth";
import { getRefreshToken, refreshAccessToken } from "@/lib/auth/session";

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
  const res = await fetch(input, {
    ...init,
    headers: { ...init.headers, ...authHeaders },
  });

  // Only retry when we have a session to refresh — anonymous read-token traffic
  // that 401s should surface as-is.
  if (res.status !== 401 || !(await getRefreshToken())) {
    return res;
  }

  const newAccess = await refreshAccessToken();
  if (!newAccess) return res;

  return fetch(input, {
    ...init,
    headers: { ...init.headers, Authorization: `Bearer ${newAccess}` },
  });
}
