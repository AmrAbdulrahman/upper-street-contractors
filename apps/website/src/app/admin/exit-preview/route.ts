import { draftMode } from "next/headers";
import { redirect } from "next/navigation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The only place `draftMode().disable()` can run (Route Handler — mirrors
 * `enable-preview`'s use of `.enable()`). The bar's Close/Log out buttons hit
 * this instead of navigating to the stripped path directly: a plain
 * navigation would still render once with Draft Mode on, since
 * `draftMode().isEnabled` reflects the *incoming* request's cookie, and
 * `proxy.ts`'s own cookie-clearing (for someone who leaves /admin by editing
 * the URL bar) only takes effect on the request *after* that one — see its
 * comment. Disabling here first means the redirect target's own request
 * never carries the cookie at all, so there's no one-render draft flash.
 *
 * No session check: leaving preview isn't a privileged action (unlike
 * `enable-preview`, which must verify `zero_cms_session` before turning
 * Draft Mode *on*) — it's always safe to turn it off.
 */
export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const nextParam = searchParams.get("next") ?? "/";
  // Guard against an open redirect, and against looping back into /admin —
  // the whole point is to land back on the public site.
  const target =
    nextParam.startsWith("/") && !nextParam.startsWith("//") && !nextParam.startsWith("/admin")
      ? nextParam
      : "/";

  const draft = await draftMode();
  draft.disable();
  redirect(target);
}
