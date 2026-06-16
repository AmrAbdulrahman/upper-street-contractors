import fs from 'node:fs';
import path from 'node:path';

type StrapiInstance = {
  service: (name: string) => {
    create: (input: {
      name: string;
      description?: string;
      type: 'read-only' | 'full-access' | 'custom';
      lifespan?: number | null;
    }) => Promise<{ accessKey: string }>;
  };
  log: {
    info: (message: string) => void;
  };
};

const TOKEN_FILE = path.resolve(process.cwd(), '.local-api-token');

export async function ensureLocalApiToken(strapi: StrapiInstance) {
  if (fs.existsSync(TOKEN_FILE)) {
    return;
  }

  const { accessKey } = await strapi.service('admin::api-token').create({
    name: 'Local Dev Autogen',
    description: 'Auto-generated for local Next.js development',
    type: 'full-access',
    lifespan: null,
  });

  fs.writeFileSync(TOKEN_FILE, accessKey, 'utf8');
  strapi.log.info('[seed] wrote local API token to apps/cms/.local-api-token');
}
