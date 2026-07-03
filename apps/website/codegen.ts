import type { CodegenConfig } from "@graphql-codegen/cli";

/**
 * Codegen against the zero-cms GraphQL schema (introspected SDL). Operations live
 * in-place across the app and are read via `cmsRead` (typed-document-node).
 */
const config: CodegenConfig = {
  schema: "apps/website/src/generated/schema.graphql",
  documents: [
    "apps/website/src/**/*.graphql",
    "!apps/website/src/generated/**",
  ],
  generates: {
    "apps/website/src/generated/graphql.ts": {
      plugins: ["typescript-operations", "typed-document-node"],
      config: {
        documentMode: "documentNode",
        enumsAsTypes: true,
        onlyOperationTypes: true,
        scalars: { JSON: "unknown" },
      },
    },
  },
};

export default config;
