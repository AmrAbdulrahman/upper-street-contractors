const DEFAULT_STRAPI_URL = "http://localhost:1337";

function getStrapiBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_STRAPI_URL ??
    process.env.STRAPI_URL ??
    DEFAULT_STRAPI_URL
  ).replace(/\/$/, "");
}

/** Strapi often returns relative `/uploads/...` paths; Next Image needs absolute URLs. */
export function resolveStrapiMediaUrl(
  url: string | null | undefined,
): string | undefined {
  if (!url?.trim()) {
    return undefined;
  }

  if (/^https?:\/\//i.test(url)) {
    return url;
  }

  const baseUrl = getStrapiBaseUrl();
  return `${baseUrl}${url.startsWith("/") ? url : `/${url}`}`;
}
