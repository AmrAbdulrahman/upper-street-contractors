import { cookies } from "next/headers";

// Editor session cookies — httpOnly, set server-side only, living on the website
// domain (the browser never talks to Strapi directly). `usc_access` carries the
// short-lived Strapi access JWT; `usc_refresh` carries the rotating refresh token
// and is the durable marker that an Editor session exists.
export const ACCESS_COOKIE = "usc_access";
export const REFRESH_COOKIE = "usc_refresh";

// Cookies persist for the refresh-token lifespan; the access JWT inside rotates.
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30d — match maxRefreshTokenLifespan

function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: COOKIE_MAX_AGE_SECONDS,
  };
}

function strapiUrl() {
  return process.env.STRAPI_URL || "http://localhost:1337";
}

export async function getAccessToken(): Promise<string | null> {
  return (await cookies()).get(ACCESS_COOKIE)?.value ?? null;
}

export async function getRefreshToken(): Promise<string | null> {
  return (await cookies()).get(REFRESH_COOKIE)?.value ?? null;
}

/** A session exists while the refresh token is present (access may have expired). */
export async function hasSession(): Promise<boolean> {
  return Boolean(await getRefreshToken());
}

export async function setSessionCookies(
  accessToken: string,
  refreshToken: string,
): Promise<void> {
  const store = await cookies();
  store.set(ACCESS_COOKIE, accessToken, cookieOptions());
  store.set(REFRESH_COOKIE, refreshToken, cookieOptions());
}

export async function clearSessionCookies(): Promise<void> {
  const store = await cookies();
  store.delete(ACCESS_COOKIE);
  store.delete(REFRESH_COOKIE);
}

/** Reads `exp` (ms since epoch) from a JWT payload without verifying the signature. */
export function decodeJwtExpMs(token: string): number | null {
  const payload = token.split(".")[1];
  if (!payload) return null;
  try {
    const json = Buffer.from(payload, "base64url").toString("utf8");
    const exp = (JSON.parse(json) as { exp?: number }).exp;
    return typeof exp === "number" ? exp * 1000 : null;
  } catch {
    return null;
  }
}

type StrapiAuthResponse = { jwt?: string; refreshToken?: string };

/**
 * Rotates the editor session using the Strapi refresh token. On success, writes
 * the new access + refresh cookies and returns the new access token. On failure,
 * clears the cookies and returns null. Only call from a Route Handler or Server
 * Action — it writes cookies, which is not allowed during RSC render.
 */
export async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) return null;

  try {
    const res = await fetch(`${strapiUrl()}/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({ refreshToken }),
    });

    if (!res.ok) {
      await clearSessionCookies();
      return null;
    }

    const data = (await res.json()) as StrapiAuthResponse;
    if (!data.jwt || !data.refreshToken) {
      await clearSessionCookies();
      return null;
    }

    await setSessionCookies(data.jwt, data.refreshToken);
    return data.jwt;
  } catch {
    return null;
  }
}
