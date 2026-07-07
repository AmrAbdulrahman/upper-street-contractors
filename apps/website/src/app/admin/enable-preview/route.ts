import { draftMode } from "next/headers";
import { redirect } from "next/navigation";
import { verifyToken } from "@usc/zero-cms-core/node";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SESSION_COOKIE = "zero_cms_session";

/**
 * The only place `draftMode().enable()` can run (Route Handler — see ADR/Next
 * docs). `proxy.ts` redirects an authenticated `/admin/*` visit here once (no
 * `__prerender_bypass` cookie yet), this sets it, then bounces straight back
 * to the page they wanted. Re-verifies the session itself rather than trusting
 * proxy.ts's redirect — this route is reachable directly, not just via proxy.
 */
export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const nextParam = searchParams.get("next") ?? "/admin";
  // Guard against an open redirect: only ever bounce back into /admin/*.
  const target = nextParam.startsWith("/admin") ? nextParam : "/admin";

  const cookieHeader = request.headers.get("cookie") ?? "";
  const token = cookieHeader
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${SESSION_COOKIE}=`))
    ?.slice(SESSION_COOKIE.length + 1);
  const secret = process.env.ZERO_CMS_AUTH_SECRET;
  const session = token && secret ? verifyToken(token, secret) : null;
  if (!session) redirect("/admin/cms");

  const draft = await draftMode();
  draft.enable();
  redirect(target);
}
