import type { Metadata } from "next";
import type {
  PageMetadataFragment,
  SiteMetaConfigFragment,
} from "@/generated/graphql";
import {
  DEFAULT_ROBOTS,
  NOINDEX_ROBOTS,
} from "@/lib/site-config";
import { resolveMediaUrl } from "./media-url";

export function normalizeSiteUrl(url: string | null | undefined): string {
  const value = url?.trim() ?? "";
  return value.replace(/\/+$/, "");
}

/**
 * The origin this deployment answers on.
 *
 * `APP_URL` has no default anywhere else, and an unset one is not a degraded
 * site but a dead one: `metadataBase: new URL("")` throws, the root layout's
 * `generateMetadata` catch calls the same throwing function, and every page
 * 500s. `APP_URL` is also in no `.env.example` — so the documented setup
 * (`cp .env.example .env.local`) produced exactly that.
 *
 * `VERCEL_URL` is the right second choice: Vercel sets it on every deployment,
 * preview and production, and the cache-warm pass (ADR 0012) already relies on
 * it. It has no scheme, hence the prefix. Localhost last, for local dev.
 *
 * A fallback, not a replacement: `APP_URL` still wins wherever it is set, so a
 * custom domain keeps naming itself rather than the deployment URL.
 */
export function resolveAppUrl(): string {
  const explicit = normalizeSiteUrl(process.env.APP_URL);
  if (explicit) return explicit;

  const vercel = normalizeSiteUrl(process.env.VERCEL_URL);
  if (vercel) return vercel.startsWith("http") ? vercel : `https://${vercel}`;

  return "http://localhost:3000";
}

function getOgImages(
  defaultImage: SiteMetaConfigFragment["defaultImage"],
): NonNullable<Metadata["openGraph"]>["images"] {
  if (!defaultImage?.url) {
    return undefined;
  }

  const imageUrl = resolveMediaUrl(defaultImage.url);
  if (!imageUrl) {
    return undefined;
  }

  return [
    {
      url: imageUrl,
      width: defaultImage.width ?? undefined,
      height: defaultImage.height ?? undefined,
      alt: defaultImage.alt ?? undefined,
    },
  ];
}

function getTwitterImages(
  images: NonNullable<Metadata["openGraph"]>["images"],
): string | string[] | undefined {
  if (!images) {
    return undefined;
  }

  const imageList = Array.isArray(images) ? images : [images];

  return imageList.map((image) => {
    if (typeof image === "string") {
      return image;
    }

    if (image instanceof URL) {
      return image.toString();
    }

    const url = image.url;
    return typeof url === "string" ? url : url.toString();
  });
}

/**
 * The images a page publishes to Open Graph / Twitter, with the site default as
 * the floor.
 *
 * Exists because Next merges metadata **shallowly per top-level key**: a page
 * returning its own `openGraph` object replaces the root one outright rather
 * than merging into it. Every page built through `pageMetaToMetadata` was doing
 * exactly that, so the whole site shipped without `og:image`, `og:type`,
 * `og:site_name` or `og:locale`, and every Twitter card silently degraded from
 * `summary_large_image` to `summary`. A page's own picture (a post hero, a
 * project hero) wins; otherwise the Brand tab's default image stands.
 */
export function resolveSocialImages(
  config: SiteMetaConfigFragment | null | undefined,
  override?: string | null,
) {
  const images = override
    ? [{ url: override }]
    : getOgImages(config?.defaultImage ?? null);

  return {
    images,
    twitterImages: getTwitterImages(images),
    card: (images ? "summary_large_image" : "summary") as
      | "summary_large_image"
      | "summary",
  };
}

/**
 * The same image as a single URL, for structured data.
 *
 * Google wants an `image` on an article node, and a post with no hero of its
 * own is still a post worth showing a picture for — so this falls back exactly
 * the way the Open Graph tags do rather than publishing no image at all.
 */
export function resolveSocialImageUrl(
  config: SiteMetaConfigFragment | null | undefined,
  override?: string | null,
): string | undefined {
  const { images } = resolveSocialImages(config, override);
  const first = Array.isArray(images) ? images[0] : images;
  if (!first) return undefined;
  if (typeof first === "string") return first;
  const url = (first as { url?: string | URL }).url;
  return typeof url === "string" ? url : url?.toString();
}

/**
 * What a route returns from `generateMetadata` when the thing it was asked for
 * does not exist.
 *
 * `notFound()` used to be called here instead. That is the right call in the
 * page component — it renders the Not Found page — but in `generateMetadata` it
 * left the head carrying the root layout's `index, follow`, which Next then
 * followed with its own injected `noindex` (Next 16 returns 200 for streamed
 * responses and marks them `noindex` in the HTML instead — see the notFound and
 * loading docs). Google resolves that pair to the most restrictive value, so
 * the URL was never at risk, but a head that says both is a contradiction every
 * third-party auditor flags and nobody reading the page can resolve. Returning
 * noindex here makes the head say one thing; the page component still throws,
 * so the Not Found UI is unchanged.
 */
export const NOT_FOUND_METADATA: Metadata = {
  robots: NOINDEX_ROBOTS,
  title: { absolute: "Page not found" },
};

export function buildBaseMetadata(
  config: SiteMetaConfigFragment | null,
): Metadata {
  const siteUrl = resolveAppUrl();
  const siteName = config?.siteName ?? "Upper Street Contractors";
  const legalName = config?.legalName ?? siteName;
  const images = getOgImages(config?.defaultImage ?? null);
  const indexable = config?.indexable !== false;

  return {
    metadataBase: new URL(siteUrl),
    title: {
      default: config?.defaultMetaTitle ?? siteName,
      template: config?.pageTitleTemplate ?? `%s | ${siteName}`,
    },
    description:
      config?.defaultMetaDescription ??
      "Upper Street Contractors — bathrooms, kitchens and refurbishments in Islington.",
    applicationName: siteName,
    authors: [{ name: legalName, url: siteUrl }],
    creator: legalName,
    publisher: legalName,
    referrer: "origin-when-cross-origin",
    robots: indexable ? DEFAULT_ROBOTS : NOINDEX_ROBOTS,
    formatDetection: {
      telephone: true,
      email: true,
      address: true,
    },
    icons: {
      icon: "/icon.svg",
      apple: "/apple-icon.svg",
    },
    openGraph: {
      type: "website",
      locale: "en_GB",
      url: siteUrl,
      siteName,
      title: config?.defaultMetaTitle ?? siteName,
      description: config?.defaultMetaDescription ?? undefined,
      images,
    },
    twitter: {
      card: "summary_large_image",
      title: config?.defaultMetaTitle ?? siteName,
      description: config?.defaultMetaDescription ?? undefined,
      images: getTwitterImages(images),
    },
  };
}

export function pageMetaToMetadata(
  meta: PageMetadataFragment | null | undefined,
  options: { path: string; config?: SiteMetaConfigFragment | null },
): Metadata {
  const { config } = options;

  // No `meta` relation: canonical only, on purpose. Returning no `openGraph`
  // key at all is what lets the root layout's own object through untouched —
  // the page inherits the site default title, description and image rather
  // than a half-built copy of them.
  if (!meta?.title && !meta?.description) {
    return {
      alternates: {
        canonical: options.path,
      },
    };
  }

  const title = meta.title ?? undefined;
  const description = meta.description ?? undefined;
  const siteName = config?.siteName ?? "Upper Street Contractors";
  const absoluteTitle = title ? `${title} | ${siteName}` : undefined;
  const { images, twitterImages, card } = resolveSocialImages(config);

  return {
    title: absoluteTitle ? { absolute: absoluteTitle } : undefined,
    description,
    alternates: {
      canonical: options.path,
    },
    // Every field the root layout sets is repeated here, not just the ones that
    // change: this object replaces the root's rather than merging with it.
    openGraph: {
      type: "website",
      locale: "en_GB",
      siteName,
      title: absoluteTitle ?? title,
      description,
      url: options.path,
      images,
    },
    twitter: {
      card,
      title: absoluteTitle ?? title,
      description,
      images: twitterImages,
    },
  };
}
