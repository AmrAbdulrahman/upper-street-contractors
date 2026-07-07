import type { MetadataRoute } from "next";
import { normalizeSiteUrl } from "@/helpers";
import { getSiteMetaConfig } from "@/components/site-meta-config";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const config = await getSiteMetaConfig();
  const siteUrl = normalizeSiteUrl(process.env.APP_URL);
  const indexable = config?.indexable !== false;

  if (!indexable) {
    return {
      rules: {
        userAgent: "*",
        disallow: "/",
      },
    };
  }

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // /admin/* is the editor surface (dashboard + Draft Mode mirror of the
      // public routes, proxy.ts) — never meant to be crawled/indexed, even
      // though the mirrored pages render the same content as their public
      // counterparts (a rewrite, so it has no metadata of its own to mark
      // noindex on — path-based robots.txt exclusion is what actually works).
      disallow: "/admin",
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
