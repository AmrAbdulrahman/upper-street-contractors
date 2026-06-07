import { existsSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

dotenv.config({ path: join(root, ".env.local") });

const spaceId = process.env.CONTENTFUL_SPACE_ID;
const environment = process.env.CONTENTFUL_ENVIRONMENT ?? "master";
const token = process.env.CONTENTFUL_ACCESS_TOKEN;

if (!spaceId || !token) {
  console.error(
    "CONTENTFUL_SPACE_ID and CONTENTFUL_ACCESS_TOKEN must be set in .env.local",
  );
  process.exit(1);
}

const APP_DIR = join(root, "src", "app");
const IGNORED_SEGMENTS = new Set(["api", "_not-found"]);

const SITEMAP_QUERY = `
  query GenerateSitemap {
    siteMetaConfigCollection(limit: 1) {
      items {
        siteUrl
        indexable
      }
    }
    pageCollection(limit: 50) {
      items {
        key
        sys {
          id
        }
      }
    }
  }
`;

function normalizeSiteUrl(url) {
  const value = (url ?? "https://upperstreet.contractors").trim();
  return value.replace(/\/+$/, "");
}

function collectAppRoutes(dir, segments = []) {
  const routes = [];

  if (
    existsSync(join(dir, "page.tsx")) ||
    existsSync(join(dir, "page.ts")) ||
    existsSync(join(dir, "page.jsx")) ||
    existsSync(join(dir, "page.js"))
  ) {
    routes.push(segments.length === 0 ? "/" : `/${segments.join("/")}`);
  }

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue;
    }

    if (IGNORED_SEGMENTS.has(entry.name)) {
      continue;
    }

    if (entry.name.startsWith("(") || entry.name.startsWith("[")) {
      continue;
    }

    routes.push(
      ...collectAppRoutes(join(dir, entry.name), [...segments, entry.name]),
    );
  }

  return routes;
}

function pageKeyToPath(key) {
  if (!key || key === "home") {
    return "/";
  }

  return `/${key}`;
}

function buildLastModifiedMap() {
  return new Map();
}

function toSitemapXml(siteUrl, routes, lastModifiedByPath) {
  const urlEntries = routes
    .sort((a, b) => a.localeCompare(b))
    .map((path) => {
      const loc = path === "/" ? siteUrl : `${siteUrl}${path}`;
      const lastmod =
        lastModifiedByPath.get(path) ?? new Date().toISOString().slice(0, 10);
      const priority = path === "/" ? "1.0" : "0.8";
      const changefreq = path === "/" ? "weekly" : "monthly";

      return `  <url>
    <loc>${loc}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlEntries}
</urlset>
`;
}

async function fetchContentful() {
  const endpoint = `https://graphql.contentful.com/content/v1/spaces/${spaceId}/environments/${environment}`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: SITEMAP_QUERY }),
  });

  const body = await response.json();

  if (!response.ok || body.errors?.length) {
    const messages = body.errors?.map((error) => error.message).join("\n");
    throw new Error(
      messages ?? `Contentful request failed: ${response.status}`,
    );
  }

  const { data } = body;

  return data;
}

async function main() {
  const data = await fetchContentful();
  const siteConfig = data.siteMetaConfigCollection?.items?.at(0);
  const siteUrl = normalizeSiteUrl(siteConfig?.siteUrl);
  const indexable = siteConfig?.indexable !== false;

  const appRoutes = [...new Set(collectAppRoutes(APP_DIR))];
  const cmsPaths = (data.pageCollection?.items ?? [])
    .map((page) => pageKeyToPath(page?.key))
    .filter(Boolean);
  const routes = [...new Set([...appRoutes, ...cmsPaths])].sort((a, b) =>
    a.localeCompare(b),
  );

  const lastModifiedByPath = buildLastModifiedMap();

  const outputPath = join(root, "public", "sitemap.xml");

  if (!indexable) {
    writeFileSync(
      outputPath,
      `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
</urlset>
`,
      "utf8",
    );
    console.log("Site not indexable — wrote empty sitemap.xml");
    return;
  }

  const xml = toSitemapXml(siteUrl, routes, lastModifiedByPath);
  writeFileSync(outputPath, xml, "utf8");

  console.log(`Generated ${outputPath} with ${routes.length} routes:`);
  for (const route of routes) {
    console.log(`  ${route}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
