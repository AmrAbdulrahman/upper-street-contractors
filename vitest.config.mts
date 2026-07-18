import { defineConfig } from 'vitest/config';

/**
 * Root runner. Vitest 4 removed `vitest.workspace.ts` support — without this
 * `projects` config a root `npx vitest run` executed every spec in a single
 * default project (no tsconfig-path resolution, no jsdom), failing all the
 * DOM-dependent lib suites. Each lib keeps its own vitest.config.mts.
 */
export default defineConfig({
  test: {
    projects: ['libs/*/vitest.config.mts'],
  },
});
