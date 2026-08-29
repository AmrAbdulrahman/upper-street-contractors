import type { SiteMetaConfigFragment } from "@/generated/graphql";
import { normalizeSiteUrl, resolveMediaUrl } from "@/helpers";

type LocalBusinessJsonLdProps = {
  config: SiteMetaConfigFragment;
};

export function LocalBusinessJsonLd({ config }: LocalBusinessJsonLdProps) {
  const siteUrl = normalizeSiteUrl(config.siteUrl);
  // `sameAs` is a structured-data claim that these URLs are the business, so it
  // must not publish whatever scheme an editor happened to type — the stored
  // WhatsApp link is `http://` today. Upgrade to https, then keep only what is
  // actually an https URL; a `mailto:` or a bare handle is not a profile page.
  const sameAs =
    config.socialLinks
      ?.map((link) => link?.url?.trim().replace(/^http:\/\//i, "https://"))
      .filter((url): url is string => Boolean(url) && /^https:\/\//i.test(url!)) ??
    [];
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
