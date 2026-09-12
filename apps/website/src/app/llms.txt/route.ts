import { resolveAppUrl } from "@/helpers";
import { getSiteMetaConfig } from "@/components/site-meta-config";
import { getAllSitePaths } from "@/lib/cms/site-routes";

/**
 * `/llms.txt` — the plain-Markdown index an LLM agent reads instead of
 * crawling the rendered site (https://llmstxt.org/).
 *
 * Built from `getAllSitePaths()`, the same list `sitemap.ts` and the
 * post-publish warm pass read (ADR 0012), so a newly published Project or post
 * appears here without a deploy and the three can never disagree about what is
 * public. Gated on the same CMS `indexable` kill-switch as `robots.ts` and
 * `sitemap.ts`: a site that is telling crawlers to stay out should not be
 * handing an agent a map of itself.
 *
 * Grouped by prefix rather than listed flat because the spec's value is the
 * headings — a list of 50 URLs is what `sitemap.xml` already is.
 */
function section(title: string, paths: string[], siteUrl: string): string {
  if (paths.length === 0) return "";
  const lines = paths.map((path) => {
    const label = path
      .replace(/^\//, "")
      .replace(/^(projects|blog)\//, "")
      .replace(/[-/]/g, " ")
      .trim();
    return `- [${label || "Home"}](${siteUrl}${path === "/" ? "" : path})`;
  });
  return `## ${title}\n\n${lines.join("\n")}\n`;
}

export async function GET(): Promise<Response> {
  const config = await getSiteMetaConfig();
  const siteUrl = resolveAppUrl();

  if (config?.indexable === false) {
    return new Response("", { status: 404 });
  }

  const paths = await getAllSitePaths();
  const siteName = config?.siteName ?? "Upper Street Contractors";
  const summary =
    config?.defaultMetaDescription ??
    "Bathrooms, kitchens and home refurbishments in Islington and North London.";

  const projects = paths.filter((p) => p.startsWith("/projects/"));
  const posts = paths.filter((p) => p.startsWith("/blog/"));
  const rest = paths.filter((p) => !projects.includes(p) && !posts.includes(p));

  const body = [
    `# ${siteName}`,
    "",
    `> ${summary}`,
    "",
    section("Pages", rest, siteUrl),
    section("Projects", projects, siteUrl),
    section("Blog", posts, siteUrl),
  ]
    .filter(Boolean)
    .join("\n");

  return new Response(body, {
    headers: { "content-type": "text/markdown; charset=utf-8" },
  });
}
