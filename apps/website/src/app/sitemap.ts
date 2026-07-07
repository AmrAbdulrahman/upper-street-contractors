import type { MetadataRoute } from "next";
import { normalizeSiteUrl } from "@/helpers";
import { getSiteMetaConfig } from "@/components/site-meta-config";
import { getAllSitePaths } from "@/lib/cms/site-routes";

/**
 * Replaces the old build-time `scripts/generate-sitemap.mjs` +
 * `public/sitemap.xml` (ADR 0012) — a static file can't reflect content
 * published after the last deploy, and Vercel's deployed functions can't
 * rewrite `public/` at runtime anyway. This is a Next-native Route Handler
 * (cached by default per Next's docs, since it uses no Request-time API),
 * invalidated by the same `revalidatePath("/", "layout")` every publish
 * already calls (`zero-cms/server.ts`), and reads live via `getAllSitePaths`
 * so a brand-new project shows up without a rebuild.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const config = await getSiteMetaConfig();
  const indexable = config?.indexable !== false;
  if (!indexable) return [];

  const siteUrl = normalizeSiteUrl(config?.siteUrl);
  const paths = await getAllSitePaths();

  return paths.map((path) => ({
    url: path === "/" ? siteUrl : `${siteUrl}${path}`,
    lastModified: new Date(),
    changeFrequency: path === "/" ? "weekly" : "monthly",
    priority: path === "/" ? 1.0 : 0.8,
  }));
}
