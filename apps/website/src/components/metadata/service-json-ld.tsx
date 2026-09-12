import { JsonLd } from "./json-ld";
import { resolveSiteOrigin } from "./site-origin";

type ServiceJsonLdProps = {
  name?: string | null;
  description?: string | null;
  /** The page's own Slug — a Service page's URL is `/<slug>` (ADR 0020). */
  slug: string;
  image?: string | null;
  config?: {
    siteUrl?: string | null;
    siteName?: string | null;
    city?: string | null;
  } | null;
};

/**
 * What a Service page offers, as a node a search engine can read.
 *
 * `provider` names the same business the sitewide LocalBusiness node describes
 * rather than repeating its address and phone number — one description of the
 * company, referenced, not two that can disagree.
 */
export function ServiceJsonLd({
  name,
  description,
  slug,
  image,
  config,
}: ServiceJsonLdProps) {
  const origin = resolveSiteOrigin(config);
  const providerName = config?.siteName ?? "Upper Street Contractors";

  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "Service",
        name: name ?? undefined,
        description: description ?? undefined,
        image: image ?? undefined,
        url: `${origin}/${slug}`,
        serviceType: name ?? undefined,
        provider: {
          "@type": "LocalBusiness",
          name: providerName,
          url: origin,
        },
        areaServed: config?.city
          ? { "@type": "City", name: config.city }
          : undefined,
      }}
    />
  );
}
