import nextEnv from '@next/env'
import { join } from 'node:path';

const workspaceRoot = join(process.cwd(), '..', '..');
nextEnv.loadEnvConfig(workspaceRoot);

const strapiUrl = process.env.STRAPI_URL ?? '';
const isRemote = strapiUrl !== '' && !/localhost|127\.0\.0\.1/.test(strapiUrl);
if (
  process.env.NODE_ENV === 'development' &&
  isRemote &&
  process.env.ALLOW_REMOTE_CMS_IN_DEV !== 'true'
) {
  throw new Error(
    `[cms-guard] Dev server pointed at REMOTE Strapi (${strapiUrl}) — this burns Cloud quota. ` +
      `Set STRAPI_URL=http://localhost:1337 + run local CMS (cd apps/cms && npm run develop), ` +
      `or set ALLOW_REMOTE_CMS_IN_DEV=true to override.`,
  );
}
