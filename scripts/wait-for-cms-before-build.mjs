import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { waitForGraphqlServer } from './wait-for-graphql-server.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

dotenv.config({ path: join(root, '.env.local'), override: true });

const isPreviewBuild = process.env.ENABLE_PREVIEW === 'true';

if (isPreviewBuild) {
  console.log('Preview build — skipping CMS readiness check.');
  process.exit(0);
}

console.log('Production build — waiting for CMS before build...');

waitForGraphqlServer().catch((error) => {
  console.error(error);
  process.exit(1);
});
