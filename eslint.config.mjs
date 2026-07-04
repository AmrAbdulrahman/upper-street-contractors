import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "apps/website/.next/**",
    "apps/cms-app/.next/**",
    "out/**",
    "apps/website/out/**",
    "build/**",
    "next-env.d.ts",
    "apps/website/next-env.d.ts",
    "apps/cms-app/next-env.d.ts",
    "apps/website/src/generated/apollo-hooks.ts",
    "zero-cms-store/generated/**",
  ]),
]);

export default eslintConfig;
