/**
 * Resolve a zero-cms media URL for use in <Image>. Media URLs are real,
 * absolute Vercel Blob URLs (ADR 0008) — this passes those through unchanged;
 * the rooted (`/…`) branch just covers any already-relative value defensively.
 */
export function resolveMediaUrl(
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
