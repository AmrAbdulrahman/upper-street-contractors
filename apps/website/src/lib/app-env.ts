/**
 * Preview is now Next's built-in Draft Mode, not a build-time env var — the
 * old `NEXT_PUBLIC_APP_ENV=preview` flag distinguished a whole separate
 * *deployment*; now that cms lives inside website and /admin/* mirrors the
 * public routes in Draft Mode (see proxy.ts), preview is a **per-request**
 * decision, and the same deployment serves both.
 *
 * Server-only by nature (`draftMode()` is a `next/headers` API) — pass the
 * resolved boolean into client components as a prop, same as before.
 */

import { draftMode } from "next/headers";

/**
 * True when the current request is being served in Draft Mode (under
 * /admin/*). `draftMode()` throws when called outside a request context —
 * notably inside `generateStaticParams`, which runs at build time to
 * enumerate static paths and has no request to be "in preview" for. Static
 * path enumeration should always see the public (published) param list
 * anyway, so that case just resolves to `false` rather than failing the
 * build.
 */
export async function isPreview(): Promise<boolean> {
  try {
    const { isEnabled } = await draftMode();
    return isEnabled;
  } catch {
    return false;
  }
}
