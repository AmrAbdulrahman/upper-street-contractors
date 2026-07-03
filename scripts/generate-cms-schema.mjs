/**
 * Generate the zero-cms GraphQL SDL (`src/generated/cms-schema.graphql`) that
 * graphql-codegen types against. Reads the app's `zero-cms.config.mjs`, builds the
 * executable schema with `buildCmsSchema()` (the same schema the runtime serves),
 * and prints it to SDL — so codegen never needs a running server.
 *
 * The zero-cms libs are TypeScript source (resolved via tsconfig paths), so we load
 * them through jiti with explicit `@usc/*` aliases. `printSchema` is pulled from the
 * same jiti realm as `buildCmsSchema` to avoid cross-realm `instanceof` mismatches.
 */

import { createJiti } from "jiti";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const lib = (p) => resolve(repoRoot, p);

const jiti = createJiti(import.meta.url, {
  alias: {
    "@usc/zero-cms-core/node": lib("libs/zero-cms-core/src/node.ts"),
    "@usc/zero-cms-core": lib("libs/zero-cms-core/src/index.ts"),
    "@usc/zero-cms-graphql": lib("libs/zero-cms-graphql/src/index.ts"),
  },
});

const { loadConfig, findConfigFile, createFsStoragePort, createNodeAdapter } =
  await jiti.import("@usc/zero-cms-core/node");
const { buildCmsSchema } = await jiti.import("@usc/zero-cms-graphql");
const { printSchema } = await jiti.import("graphql");

// Optional project dir to search from (defaults to cwd), e.g. `… apps/website`.
const searchFrom = process.argv[2]
  ? resolve(process.cwd(), process.argv[2])
  : process.cwd();

const configFile = await findConfigFile(searchFrom);
if (!configFile) {
  throw new Error(
    `zero-cms: no zero-cms.config.mjs found (searched up from ${searchFrom})`,
  );
}

const config = await loadConfig(configFile);
const port = createFsStoragePort(config);
const adapter = await createNodeAdapter(port);

const schema = await adapter.getSchema();
const sdl = printSchema(buildCmsSchema({ schema, adapter }));

const outFile = resolve(dirname(configFile), "src/generated/schema.graphql");
mkdirSync(dirname(outFile), { recursive: true });
writeFileSync(outFile, `${sdl}\n`);

console.log(`zero-cms: wrote GraphQL SDL -> ${outFile}`);
