import { NextRequest, NextResponse } from "next/server";
import { getStrapiUrl } from "@/lib/strapi-auth";
import { decodeJwtExpMs, setSessionCookies } from "@/lib/auth/session";

// Logs an Editor in against Strapi's Users & Permissions plugin and stores the
// resulting access + refresh tokens as httpOnly cookies on the website domain.
export async function POST(request: NextRequest) {
  let body: { identifier?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }

  const { identifier, password } = body;
  if (!identifier || !password) {
    return NextResponse.json(
      { ok: false, error: "Email and password are required." },
      { status: 400 },
    );
  }

  let res: Response;
  try {
    res = await fetch(`${getStrapiUrl()}/api/auth/local`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({ identifier, password }),
    });
  } catch {
    return NextResponse.json({ ok: false, error: "Could not reach the CMS." }, { status: 502 });
  }

  const data = (await res.json().catch(() => null)) as
    | { jwt?: string; refreshToken?: string; error?: { message?: string } }
    | null;

  if (!res.ok) {
    return NextResponse.json(
      { ok: false, error: data?.error?.message ?? "Invalid email or password." },
      { status: res.status },
    );
  }

  if (!data?.jwt || !data?.refreshToken) {
    return NextResponse.json(
      { ok: false, error: "CMS session mode is not enabled (no refresh token returned)." },
      { status: 500 },
    );
  }

  await setSessionCookies(data.jwt, data.refreshToken);
  return NextResponse.json({ ok: true, exp: decodeJwtExpMs(data.jwt) });
}
