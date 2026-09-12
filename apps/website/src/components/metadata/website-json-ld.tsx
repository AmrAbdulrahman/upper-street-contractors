import { JsonLd } from "./json-ld";
import { resolveSiteOrigin } from "./site-origin";

/**
 * The site itself, as one node.
 *
 * Small on purpose: no `SearchAction`, because the only search on the site
 * filters the already-loaded Blog index client-side — there is no URL a search
 * engine could send a query to, and claiming one it cannot use is worse than
 * claiming nothing.
 */
export function WebSiteJsonLd({
  config,
}: {
  config: { siteUrl?: string | null; siteName?: string | null } | null;
}) {
  const origin = resolveSiteOrigin(config);

  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "WebSite",
        name: config?.siteName ?? "Upper Street Contractors",
        url: origin,
        inLanguage: "en-GB",
      }}
    />
  );
}
