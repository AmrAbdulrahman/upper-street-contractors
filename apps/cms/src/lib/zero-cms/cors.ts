/**
 * CORS for the zero-cms RPC/auth/media/graphql surface.
 *
 * Today (same-origin, inside apps/website) none of this existed — cms is a
 * separate origin reachable from the browser (admin UI, Inspect-mode overlay), both
 * using a Bearer-token-in-localStorage client (see zero-cms-app's auth-client.ts),
 * not cookies — so no credentialed-CORS/SameSite complexity, just a plain origin
 * allow-list.
 *
 * `ZERO_CMS_ALLOWED_ORIGINS` — comma-separated exact origins, e.g.
 *   https://staging.example.com,http://localhost:3000
 * Fails closed: an unrecognized Origin gets no CORS headers, browser blocks it.
 */
const allowedOrigins = (process.env.ZERO_CMS_ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

function corsHeaders(origin: string | null): Record<string, string> {
  if (!origin || !allowedOrigins.includes(origin)) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, content-type",
    Vary: "Origin",
  };
}

/**
 * Wraps a Next route handler: answers OPTIONS preflight directly, and stamps CORS
 * headers onto whatever the handler returns for the real request.
 */
export function withCors<Args extends unknown[]>(
  handler: (req: Request, ...args: Args) => Promise<Response>
): (req: Request, ...args: Args) => Promise<Response> {
  return async (req: Request, ...args: Args): Promise<Response> => {
    const headers = corsHeaders(req.headers.get("origin"));
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });

    const res = await handler(req, ...args);
    const merged = new Headers(res.headers);
    for (const [k, v] of Object.entries(headers)) merged.set(k, v);
    return new Response(res.body, {
      status: res.status,
      statusText: res.statusText,
      headers: merged,
    });
  };
}
