import type { SiteMetaConfigFragment } from "@/generated/graphql";
import { normalizeSiteUrl } from "@/components/metadata/to-metadata";

type LocalBusinessJsonLdProps = {
  config: SiteMetaConfigFragment;
};

export function LocalBusinessJsonLd({ config }: LocalBusinessJsonLdProps) {
  const siteUrl = normalizeSiteUrl(config.siteUrl);
  const sameAs =
    config.socialLinksCollection?.items
      ?.map((link) => link?.url)
      .filter((url): url is string => Boolean(url)) ?? [];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: config.siteName ?? "Upper Street Contractors",
    legalName: config.legalName ?? undefined,
    url: siteUrl,
    telephone: config.phoneNumber ?? undefined,
    email: config.email ?? undefined,
    image: config.defaultImage?.url ?? undefined,
    address: {
      "@type": "PostalAddress",
      streetAddress: config.addressLine ?? undefined,
      addressLocality: config.city ?? undefined,
      postalCode: config.postalCode ?? undefined,
      addressCountry: "GB",
    },
    geo:
      config.mapLocation?.lat != null && config.mapLocation?.lon != null
        ? {
            "@type": "GeoCoordinates",
            latitude: config.mapLocation.lat,
            longitude: config.mapLocation.lon,
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
