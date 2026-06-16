import fs from 'node:fs';
import path from 'node:path';

function isLocalStrapiUrl(url: string) {
  return /localhost|127\.0\.0\.1/.test(url);
}

function getLocalTokenPath() {
  const candidates = [
    path.resolve(process.cwd(), '../cms/.local-api-token'),
    path.resolve(process.cwd(), 'apps/cms/.local-api-token'),
    path.resolve(process.cwd(), '.local-api-token'),
  ];

  return candidates.find((candidate) => fs.existsSync(candidate));
}

export function getStrapiUrl() {
  return process.env.STRAPI_URL || 'http://localhost:1337';
}

export function getStrapiGraphqlEndpoint() {
  return `${getStrapiUrl()}/graphql`;
}

export function getStrapiAuthHeaders(): Record<string, string> {
  const url = getStrapiUrl();

  if (isLocalStrapiUrl(url)) {
    const localTokenPath = getLocalTokenPath();

    if (localTokenPath) {
      const token = fs.readFileSync(localTokenPath, 'utf8').trim();
      return { Authorization: `Bearer ${token}` };
    }
  }

  const token = process.env.STRAPI_API_TOKEN;
  if (!token) {
    throw new Error('STRAPI_API_TOKEN is not set');
  }

  return { Authorization: `Bearer ${token}` };
}
