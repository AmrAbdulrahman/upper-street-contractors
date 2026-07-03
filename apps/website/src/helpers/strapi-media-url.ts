/**
 * Resolve a zero-cms media URL for use in <Image>. zero-cms serves media from a
 * site-relative route (`/api/cms/media/<id>`), so already-rooted (`/…`) and
 * absolute (`http(s)://…`) URLs pass through unchanged.
 */
export function resolveStrapiMediaUrl(
  url: string | null | undefined,
): string | undefined {
  if (!url?.trim()) {
    return undefined;
  }

  if (/^https?:\/\//i.test(url) || url.startsWith("/")) {
    return url;
  }

  return `/${url}`;
}
