import type { SiteMetaConfigFragment } from "@/generated/graphql";
import { normalizeSiteUrl, resolveMediaUrl } from "@/helpers";

type LocalBusinessJsonLdProps = {
  config: SiteMetaConfigFragment;
};

export function LocalBusinessJsonLd({ config }: LocalBusinessJsonLdProps) {
  const siteUrl = normalizeSiteUrl(config.siteUrl);
  const sameAs =
    config.socialLinks
      ?.map((link) => link?.url)
      .filter((url): url is string => Boolean(url)) ?? [];
  const mapLocation = config.mapLocation as
    | { lat?: number | null; lon?: number | null }
    | null
    | undefined;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: config.siteName ?? "Upper Street Contractors",
    legalName: config.legalName ?? undefined,
    url: siteUrl,
    telephone: config.phoneNumber ?? undefined,
    email: config.email ?? undefined,
    image: resolveMediaUrl(config.defaultImage?.url),
    address: {
      "@type": "PostalAddress",
      streetAddress: config.addressLine ?? undefined,
      addressLocality: config.city ?? undefined,
      postalCode: config.postalCode ?? undefined,
      addressCountry: "GB",
    },
    geo:
      mapLocation?.lat != null && mapLocation?.lon != null
        ? {
            "@type": "GeoCoordinates",
            latitude: mapLocation.lat,
            longitude: mapLocation.lon,
          }
        : undefined,
    sameAs: sameAs.length > 0 ? sameAs : undefined,
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}
