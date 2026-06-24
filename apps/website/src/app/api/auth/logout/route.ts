import { NextResponse } from "next/server";
import { getStrapiUrl } from "@/lib/strapi-auth";
import { clearSessionCookies, getAccessToken } from "@/lib/auth/session";

// Revokes the Strapi refresh token (best-effort) and clears the session cookies.
export async function POST() {
  const access = await getAccessToken();

  if (access) {
    try {
      await fetch(`${getStrapiUrl()}/api/auth/logout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${access}`,
        },
        cache: "no-store",
      });
    } catch {
      // Best-effort server-side revoke; clearing the cookies below still ends
      // the session for this browser.
    }
  }

  await clearSessionCookies();
  return NextResponse.json({ ok: true });
}
