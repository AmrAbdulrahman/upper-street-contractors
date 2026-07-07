/**
 * Generate the zero-cms GraphQL SDL (`src/generated/schema.graphql`) that
 * graphql-codegen types against. Builds the executable schema with
 * `buildCmsSchema()` (the same schema the runtime serves) against the live
 * Redis store (ADR 0008) and prints it to SDL — so codegen never needs a
 * running server, just network access to Upstash (same as `next build`).
 *
 * Schema is the single source of truth in Redis now (no more local fs store
 * fallback) — this uses the read-only token, same as page rendering, since
 * generating SDL never mutates.
 *
 * The zero-cms libs are TypeScript source (resolved via tsconfig paths), so we load
 * them through jiti with explicit `@usc/*` aliases. `printSchema` is pulled from the
 * same jiti realm as `buildCmsSchema` to avoid cross-realm `instanceof` mismatches.
 */

import { createJiti } from "jiti";
import nextEnv from "@next/env";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const lib = (p) => resolve(repoRoot, p);

// Same loader `apps/website/env.mjs` uses — picks up `.env.local` at the repo
// root (this script always runs with cwd = workspaceRoot, per project.json).
nextEnv.loadEnvConfig(repoRoot);

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`generate-cms-schema: ${name} is required`);
  return v;
}

const jiti = createJiti(import.meta.url, {
  alias: {
    "@usc/zero-cms-core/node": lib("libs/zero-cms-core/src/node.ts"),
    "@usc/zero-cms-core": lib("libs/zero-cms-core/src/index.ts"),
    "@usc/zero-cms-graphql": lib("libs/zero-cms-graphql/src/index.ts"),
  },
});

const { createRedisAdapter } = await jiti.import("@usc/zero-cms-core/node");
const { buildCmsSchema } = await jiti.import("@usc/zero-cms-graphql");
const { printSchema } = await jiti.import("graphql");

// Project dir to write the SDL into, e.g. `… apps/website` (defaults to cwd).
const appDir = process.argv[2] ? resolve(process.cwd(), process.argv[2]) : process.cwd();

const adapter = await createRedisAdapter(
  {
    url: requireEnv("STORAGE_KV_REST_API_URL"),
    token: requireEnv("STORAGE_KV_REST_API_READ_ONLY_TOKEN"),
  },
  { token: requireEnv("BLOB_READ_WRITE_TOKEN") }
);

const schema = await adapter.getSchema();
const sdl = printSchema(buildCmsSchema({ schema, adapter }));

const outFile = resolve(appDir, "src/generated/schema.graphql");
mkdirSync(dirname(outFile), { recursive: true });
writeFileSync(outFile, `${sdl}\n`);

console.log(`zero-cms: wrote GraphQL SDL -> ${outFile}`);
