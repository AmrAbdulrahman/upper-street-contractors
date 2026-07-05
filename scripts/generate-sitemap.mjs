import { existsSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { createJiti } from "jiti";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

dotenv.config({ path: join(root, ".env.local"), override: true });

const APP_DIR = join(root, "apps", "website", "src", "app");
const IGNORED_SEGMENTS = new Set(["api", "_not-found"]);

// Reads straight off the local zero-cms store (same jiti-loading pattern as
// scripts/generate-cms-schema.mjs) — build-time-only, no network/server needed.
const jiti = createJiti(import.meta.url, {
  alias: {
    "@usc/zero-cms-core/node": join(root, "libs/zero-cms-core/src/node.ts"),
    "@usc/zero-cms-core": join(root, "libs/zero-cms-core/src/index.ts"),
  },
});

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

function toSitemapXml(siteUrl, routes) {
  const urlEntries = routes
    .sort((a, b) => a.localeCompare(b))
    .map((path) => {
      const loc = path === "/" ? siteUrl : `${siteUrl}${path}`;
      const lastmod = new Date().toISOString().slice(0, 10);
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

async function readCmsData() {
  const { loadConfig, findConfigFile, createFsStoragePort, createNodeAdapter } =
    await jiti.import("@usc/zero-cms-core/node");

  const configFile = await findConfigFile(join(root, "apps", "website"));
  if (!configFile) {
    return null;
  }

  const config = await loadConfig(configFile);
  const port = createFsStoragePort(config);
  const adapter = await createNodeAdapter(port);

  const [siteConfigs, pages, projects] = await Promise.all([
    adapter.query("site-meta-config", { page: { limit: 1 } }),
    adapter.query("page", { page: { limit: 50 } }),
    adapter.query("project", { page: { limit: 100 } }),
  ]);

  return {
    siteConfig: siteConfigs.data.at(0) ?? null,
    pages: pages.data,
    projects: projects.data,
  };
}

async function main() {
  let data;

  try {
    data = await readCmsData();
  } catch (error) {
    console.warn(
      `Could not read zero-cms store (${error.message}). Falling back to app routes only.`,
    );
    data = null;
  }

  const siteUrl = normalizeSiteUrl(data?.siteConfig?.siteUrl);
  const indexable = data?.siteConfig?.indexable !== false;

  const appRoutes = [...new Set(collectAppRoutes(APP_DIR))];
  const cmsPaths = (data?.pages ?? [])
    .map((page) => pageKeyToPath(page?.key))
    .filter(Boolean);
  const projectPaths = (data?.projects ?? [])
    .filter((project) => project?.__id)
    .map((project) => `/projects/${project.__id}`);
  const routes = [
    ...new Set([...appRoutes, ...cmsPaths, ...projectPaths]),
  ].sort((a, b) => a.localeCompare(b));

  const outputPath = join(root, "apps", "website", "public", "sitemap.xml");

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

  const xml = toSitemapXml(siteUrl, routes);
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
