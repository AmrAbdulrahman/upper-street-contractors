import type { MetadataRoute } from "next";
import { normalizeSiteUrl } from "@/helpers";
import { getSiteMetaConfig } from "@/components/site-meta-config";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const config = await getSiteMetaConfig();
  const siteUrl = normalizeSiteUrl(config?.siteUrl);
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
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
