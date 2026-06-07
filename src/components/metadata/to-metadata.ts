import type { Metadata } from "next";
import type {
  PageMetadataFragment,
  SiteMetaConfigFragment,
} from "@/generated/graphql";
import {
  DEFAULT_ROBOTS,
  FALLBACK_SITE_URL,
  NOINDEX_ROBOTS,
} from "@/lib/site-config";

export function normalizeSiteUrl(url: string | null | undefined): string {
  const value = url?.trim() || FALLBACK_SITE_URL;
  return value.replace(/\/+$/, "");
}

function getOgImages(
  defaultImage: SiteMetaConfigFragment["defaultImage"],
): NonNullable<Metadata["openGraph"]>["images"] {
  if (!defaultImage?.url) {
    return undefined;
  }

  return [
    {
      url: defaultImage.url,
      width: defaultImage.width ?? undefined,
      height: defaultImage.height ?? undefined,
      alt: defaultImage.title ?? undefined,
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

export function buildBaseMetadata(
  config: SiteMetaConfigFragment | null,
): Metadata {
  const siteUrl = normalizeSiteUrl(config?.siteUrl);
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
      locale: config?.locale ?? "en_GB",
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
  options: { path: string; siteName?: string },
): Metadata {
  if (!meta?.title && !meta?.description) {
    return {
      alternates: {
        canonical: options.path,
      },
    };
  }

  const title = meta.title ?? undefined;
  const description = meta.description ?? undefined;
  const siteName = options.siteName ?? "Upper Street Contractors";
  const absoluteTitle = title ? `${title} | ${siteName}` : undefined;

  return {
    title: absoluteTitle ? { absolute: absoluteTitle } : undefined,
    description,
    alternates: {
      canonical: options.path,
    },
    openGraph: {
      title: absoluteTitle ?? title,
      description,
      url: options.path,
    },
    twitter: {
      title: absoluteTitle ?? title,
      description,
    },
  };
}
