import { getBearer, verifyToken } from "@usc/zero-cms-core/node";
import { getZeroCmsAuthHandler } from "@/lib/zero-cms/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SESSION_COOKIE = "zero_cms_session";

function setSessionCookie(res: Response, token: string): void {
  res.headers.append(
    "Set-Cookie",
    `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=604800`
  );
}

/**
 * A successful `login`/`changePassword` op returns `{ token, user }` — same
 * as always, for the existing Bearer/localStorage flow (zero-cms-app/widget
 * need no changes). This *also* mirrors the token into an httpOnly cookie,
 * purely so proxy.ts (server-side, no access to localStorage) can check the
 * session before deciding whether to gate/rewrite /admin/*.
 *
 * Any *other* successful authed op (`me`, `listUsers`, ...) that carries a
 * still-valid Bearer token also refreshes the cookie to match. Without this,
 * the cookie and the localStorage token can drift apart — a session started
 * before this cookie-mirroring existed, or one whose cookie simply expired/
 * got cleared, leaves the dashboard working fine (it only checks the Bearer
 * token) while proxy.ts sees no cookie and bounces `/admin/*` to `/admin/cms`
 * as if signed out. AuthGate calls `me()` on every mount, so this self-heals
 * on the very next dashboard visit rather than requiring a fresh login.
 *
 * `logout` isn't a real zero-cms-core op (the JWT is stateless — the client
 * just drops it) but the cookie needs an explicit clear, or it outlives a
 * client-side "logout" for its full 7-day Max-Age. Handled here, not in core,
 * since it's purely a cookie concern.
 */
export async function POST(req: Request): Promise<Response> {
  const bodyText = await req.clone().text();
  if (JSON.parse(bodyText || "{}")?.op === "logout") {
    const res = new Response(JSON.stringify({ ok: true }), {
      headers: { "content-type": "application/json" },
    });
    res.headers.append(
      "Set-Cookie",
      `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`
    );
    return res;
  }

  const handle = await getZeroCmsAuthHandler();
  const res = await handle(req);

  if (!res.ok) return res;

  const body = (await res.json().catch(() => null)) as { token?: string } | null;
  const rebuilt = new Response(JSON.stringify(body), {
    status: res.status,
    headers: res.headers,
  });

  if (body?.token) {
    setSessionCookie(rebuilt, body.token);
  } else {
    const bearer = getBearer(req);
    const secret = process.env.ZERO_CMS_AUTH_SECRET;
    if (bearer && secret && verifyToken(bearer, secret)) {
      setSessionCookie(rebuilt, bearer);
    }
  }

  return rebuilt;
}
