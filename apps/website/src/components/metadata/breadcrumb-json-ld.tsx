import { JsonLd } from "./json-ld";
import { resolveSiteOrigin } from "./site-origin";

export type Crumb = {
  name: string;
  /** Site-relative, e.g. `/projects`. Omitted on the current page. */
  path?: string;
};

type BreadcrumbJsonLdProps = {
  /** Without "Home" — it is prepended here so every trail starts the same. */
  trail: Crumb[];
  config?: { siteUrl?: string | null } | null;
};

/**
 * The trail a search result shows in place of a bare URL.
 *
 * Takes explicit crumbs rather than reading the path: a Server Component has no
 * pathname, and the route that renders this is the one place that already knows
 * both where it sits and what to call itself. The Page Hero draws a visible
 * `Home / <label>` for the same reason — where both exist on a page they are
 * built from the same two facts, so they agree.
 */
export function BreadcrumbJsonLd({ trail, config }: BreadcrumbJsonLdProps) {
  const origin = resolveSiteOrigin(config);
  const items = [{ name: "Home", path: "/" }, ...trail];

  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: items.map((crumb, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: crumb.name,
          // The last crumb is the page you are on; schema.org wants no `item`
          // for it, since a breadcrumb link to the current page is not a link.
          item: crumb.path ? `${origin}${crumb.path === "/" ? "" : crumb.path}` : undefined,
        })),
      }}
    />
  );
}
