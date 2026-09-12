import "server-only";

import { normalizeSiteUrl, resolveAppUrl } from "@/helpers";

/**
 * The one origin every absolute URL on the site is built from.
 *
 * Structured data used to take its origin from the CMS `siteUrl` field while
 * `metadata.ts`, `robots.ts` and `sitemap.ts` took theirs from `APP_URL` — two
 * independent answers to "where does this site live", free to disagree. A
 * LocalBusiness node claiming one origin while the canonical on the same page
 * names another is precisely the contradiction structured data is read to
 * resolve. `APP_URL` wins because it is what canonicals already use; the CMS
 * field is the fallback so an editor-set value still has somewhere to be used.
 */
export function resolveSiteOrigin(
  config?: { siteUrl?: string | null } | null,
): string {
  return resolveAppUrl() || normalizeSiteUrl(config?.siteUrl);
}
