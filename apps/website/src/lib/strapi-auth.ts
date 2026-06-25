import fs from 'node:fs';
import path from 'node:path';
import { getAccessToken } from '@/lib/auth/session';

function isLocalStrapiUrl(url: string) {
  return /localhost|127\.0\.0\.1/.test(url);
}

/** Login gate (and thus editor JWT sessions) only run on staging/preview builds. */
function isEditorSessionPossible() {
  return process.env.ENABLE_PREVIEW === 'true';
}

function getLocalTokenPath() {
  const candidates = [
    path.resolve(process.cwd(), '../cms/.local-api-token'),
    path.resolve(process.cwd(), 'apps/cms/.local-api-token'),
    path.resolve(process.cwd(), '.local-api-token'),
  ];

  return candidates.find((candidate) => fs.existsSync(candidate));
}

export function getStrapiUrl(): string {
  const url = process.env.STRAPI_URL || 'http://localhost:1337';
  if (
    process.env.NODE_ENV === 'development' &&
    !isLocalStrapiUrl(url) &&
    process.env.ALLOW_REMOTE_CMS_IN_DEV !== 'true'
  ) {
    throw new Error(
      `[cms-guard] Dev server making request to REMOTE Strapi (${url}). ` +
        `Set STRAPI_URL=http://localhost:1337 + run local CMS (cd apps/cms && npm run develop), ` +
        `or set ALLOW_REMOTE_CMS_IN_DEV=true to override.`,
    );
  }
  return url;
}

export function getStrapiGraphqlEndpoint() {
  return `${getStrapiUrl()}/graphql`;
}

/**
 * Cookie-free credential resolution: local file token or STRAPI_API_TOKEN.
 * Safe to call inside `unstable_cache` (no `cookies()` or `headers()`).
 */
export async function getServiceAuthHeaders(): Promise<Record<string, string>> {
  const url = getStrapiUrl();

  if (isLocalStrapiUrl(url)) {
    const localTokenPath = getLocalTokenPath();
    if (localTokenPath) {
      const token = fs.readFileSync(localTokenPath, 'utf8').trim();
      return { Authorization: `Bearer ${token}` };
    }
  }

  const token = process.env.STRAPI_API_TOKEN;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * Resolves the Authorization header for a Strapi request, in priority order:
 *  1. Staging with a logged-in Editor → that Editor's access JWT (per-user).
 *  2. Local dev (localhost) → the full-access `.local-api-token` file (no login).
 *  3. Fallback → the read-only `STRAPI_API_TOKEN` service token (anonymous
 *     published reads on production, builds, and staging-before-login).
 *
 * The cookie is only read when an editor session is possible (`ENABLE_PREVIEW`),
 * so production reads never call `cookies()` and stay statically rendered.
 * Returns `{}` (unauthenticated) when no credential is available.
 */
export async function getStrapiAuthHeaders(): Promise<Record<string, string>> {
  const url = getStrapiUrl();

  if (!isLocalStrapiUrl(url) && isEditorSessionPossible()) {
    try {
      const accessToken = await getAccessToken();
      if (accessToken) return { Authorization: `Bearer ${accessToken}` };
    } catch {
      // build time (generateStaticParams) — cookies() throws, fall through to service token
    }
  }

  return getServiceAuthHeaders();
}
