import {
  existsSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

dotenv.config({ path: join(root, ".env.local"), override: true });

const APP_DIR = join(root, "apps", "website", "src", "app");
const IGNORED_SEGMENTS = new Set(["api", "_not-found"]);

const SITEMAP_QUERY = `
  query GenerateSitemap {
    siteMetaConfigs(pagination: { limit: 1 }) {
      siteUrl
      indexable
    }
    pages(pagination: { limit: 50 }) {
      key
    }
    projectCards(pagination: { limit: 100 }) {
      documentId
    }
  }
`;

function isLocalStrapiUrl(url) {
  return /localhost|127\.0\.0\.1/.test(url);
}

function getStrapiUrlCandidates() {
  const urls = [];
  const add = (url) => {
    if (!url) {
      return;
    }

    const normalized = url.replace(/\/$/, "");
    if (!urls.includes(normalized)) {
      urls.push(normalized);
    }
  };

  add(process.env.STRAPI_URL);
  add(process.env.STRAPI_CLOUD_URL);

  if (urls.length === 0) {
    urls.push("http://localhost:1337");
  }

  return urls;
}

function getStrapiAuthHeaders(url) {
  if (isLocalStrapiUrl(url)) {
    const localTokenPath = [
      join(root, "apps", "cms", ".local-api-token"),
      join(root, ".local-api-token"),
    ].find((candidate) => existsSync(candidate));

    if (localTokenPath) {
      const token = readFileSync(localTokenPath, "utf8").trim();
      return { Authorization: `Bearer ${token}` };
    }
  }

  const cloudUrl = process.env.STRAPI_CLOUD_URL?.replace(/\/$/, "");
  const token =
    cloudUrl && url === cloudUrl && process.env.STRAPI_CLOUD_API_TOKEN
      ? process.env.STRAPI_CLOUD_API_TOKEN
      : process.env.STRAPI_API_TOKEN;

  if (!token) {
    console.error(
      "STRAPI_API_TOKEN must be set in .env.local (or run Strapi locally with apps/cms/.local-api-token)",
    );
    process.exit(1);
  }

  return { Authorization: `Bearer ${token}` };
}

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

async function fetchStrapiFrom(url) {
  const endpoint = `${url}/graphql`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      ...getStrapiAuthHeaders(url),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: SITEMAP_QUERY }),
  });

  const body = await response.json();

  if (!response.ok || body.errors?.length) {
    const messages = body.errors?.map((error) => error.message).join("\n");
    throw new Error(
      messages ?? `Strapi GraphQL request failed: ${response.status}`,
    );
  }

  return body.data;
}

function isConnectionError(error) {
  const code = error?.cause?.code;
  return (
    code === "ECONNREFUSED" ||
    code === "ENOTFOUND" ||
    code === "ETIMEDOUT" ||
    error?.message === "fetch failed"
  );
}

function formatStrapiFailure(error, candidates) {
  const tried = candidates.join(", ");
  const localUnavailable = candidates.some((url) => isLocalStrapiUrl(url));
  const cloudTried = candidates.some((url) => !isLocalStrapiUrl(url));
  const authFailure = /401|403/.test(String(error?.message));

  let hint =
    "Start local CMS with `npm run dev:cms`, or set STRAPI_CLOUD_API_TOKEN for cloud fallback.";

  if (localUnavailable && cloudTried && authFailure) {
    hint =
      "Local Strapi was unavailable and cloud rejected the token. Start `npm run dev:cms`, or add STRAPI_CLOUD_API_TOKEN to .env.local for your Strapi Cloud API token.";
  } else if (localUnavailable && !cloudTried) {
    hint =
      "Start local CMS with `npm run dev:cms`, or set STRAPI_CLOUD_URL in .env.local for build-time fallback.";
  }

  return `Strapi unavailable (${tried}). ${hint}`;
}

async function fetchStrapi() {
  const candidates = getStrapiUrlCandidates();
  let lastError;

  for (const url of candidates) {
    try {
      const data = await fetchStrapiFrom(url);

      if (url !== candidates[0]) {
        console.log(`Using Strapi at ${url} (${candidates[0]} unavailable)`);
      }

      return data;
    } catch (error) {
      lastError = error;

      if (isConnectionError(error) && url !== candidates.at(-1)) {
        continue;
      }

      if (isConnectionError(error)) {
        break;
      }

      throw new Error(formatStrapiFailure(error, candidates), { cause: error });
    }
  }

  throw new Error(formatStrapiFailure(lastError, candidates), { cause: lastError });
}

async function main() {
  let data;

  try {
    data = await fetchStrapi();
  } catch (error) {
    console.warn(`${error.message} Falling back to app routes only.`);
    data = null;
  }

  const siteConfig = data?.siteMetaConfigs?.at(0);
  const siteUrl = normalizeSiteUrl(siteConfig?.siteUrl);
  const indexable = siteConfig?.indexable !== false;

  const appRoutes = [...new Set(collectAppRoutes(APP_DIR))];
  const cmsPaths = (data?.pages ?? [])
    .map((page) => pageKeyToPath(page?.key))
    .filter(Boolean);
  const projectPaths = (data?.projectCards ?? [])
    .filter((card) => card?.documentId)
    .map((card) => `/projects/${card.documentId}`);
  const routes = [
    ...new Set([...appRoutes, ...cmsPaths, ...projectPaths]),
  ].sort((a, b) => a.localeCompare(b));

  const lastModifiedByPath = buildLastModifiedMap();

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
