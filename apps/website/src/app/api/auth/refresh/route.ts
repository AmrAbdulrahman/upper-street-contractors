import { NextResponse } from "next/server";
import { decodeJwtExpMs, refreshAccessToken } from "@/lib/auth/session";

// Rotates the editor session using the refresh-token cookie. Called by the
// client refresh scheduler before access expiry, and as the 401 recovery path.
export async function POST() {
  const accessToken = await refreshAccessToken();
  if (!accessToken) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  return NextResponse.json({ ok: true, exp: decodeJwtExpMs(accessToken) });
}
