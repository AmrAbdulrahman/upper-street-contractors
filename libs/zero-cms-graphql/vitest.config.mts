import { defineConfig } from 'vitest/config';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import { nxCopyAssetsPlugin } from '@nx/vite/plugins/nx-copy-assets.plugin';

export default defineConfig(() => ({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/libs/zero-cms-graphql',
  plugins: [nxViteTsPaths(), nxCopyAssetsPlugin(['*.md'])],
  // Avoid two `graphql` realms (graphql-tools vs graphql-js execute).
  resolve: { dedupe: ['graphql'] },
  ssr: { noExternal: ['graphql', /@graphql-tools/] },
  test: {
    name: 'zero-cms-graphql',
    watch: false,
    globals: true,
    environment: 'node',
    server: { deps: { inline: ['graphql', /@graphql-tools/] } },
    include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: '../../coverage/libs/zero-cms-graphql',
      provider: 'v8' as const,
    },
  },
}));
