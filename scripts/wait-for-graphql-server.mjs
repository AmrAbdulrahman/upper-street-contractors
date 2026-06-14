import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

dotenv.config({ path: join(root, '.env.local') });

const strapiUrl = (process.env.STRAPI_URL || 'http://localhost:1337').replace(
  /\/+$/,
  '',
);
const strapiToken = process.env.STRAPI_API_TOKEN;
const graphqlUrl = `${strapiUrl}/graphql`;
const timeoutMs = Number(process.env.WAIT_FOR_GRAPHQL_TIMEOUT_MS ?? 300_000);
const intervalMs = Number(process.env.WAIT_FOR_GRAPHQL_INTERVAL_MS ?? 2_000);
const requestTimeoutMs = Number(
  process.env.WAIT_FOR_GRAPHQL_REQUEST_TIMEOUT_MS ?? 15_000,
);
const heartbeatIntervalMs = Number(
  process.env.WAIT_FOR_GRAPHQL_HEARTBEAT_MS ?? 5_000,
);

const HEALTH_QUERY = 'query { __typename }';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isHtmlResponse(text) {
  const trimmed = text.trimStart();
  return trimmed.startsWith('<!DOCTYPE') || trimmed.startsWith('<html');
}

function isGraphqlResponse(body) {
  return (
    typeof body === 'object' &&
    body !== null &&
    ('data' in body || Array.isArray(body.errors))
  );
}

async function pingGraphql() {
  const headers = {
    'Content-Type': 'application/json',
  };

  if (strapiToken) {
    headers.Authorization = `Bearer ${strapiToken}`;
  }

  const response = await fetch(graphqlUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query: HEALTH_QUERY }),
    signal: AbortSignal.timeout(requestTimeoutMs),
  });

  const text = await response.text();

  if (isHtmlResponse(text)) {
    return {
      ready: false,
      reason: `HTTP ${response.status} HTML response (server likely waking up)`,
    };
  }

  let body;
  try {
    body = JSON.parse(text);
  } catch {
    return { ready: false, reason: 'Non-JSON response' };
  }

  if (isGraphqlResponse(body)) {
    return { ready: true };
  }

  return { ready: false, reason: 'Unexpected GraphQL response shape' };
}

async function waitForGraphqlServer() {
  const startedAt = Date.now();
  let attempt = 0;

  console.log(`Waiting for GraphQL at ${graphqlUrl}...`);

  const heartbeat = setInterval(() => {
    const elapsedSeconds = Math.round((Date.now() - startedAt) / 1000);
    console.log(`Still waiting for GraphQL (${elapsedSeconds}s elapsed)...`);
  }, heartbeatIntervalMs);

  try {
    while (Date.now() - startedAt < timeoutMs) {
      attempt += 1;

      try {
        const result = await pingGraphql();

        if (result.ready) {
          const elapsedSeconds = Math.round((Date.now() - startedAt) / 1000);
          console.log(
            `GraphQL ready after ${elapsedSeconds}s total wait (${attempt} attempt${attempt === 1 ? '' : 's'}).`,
          );
          return;
        }

        console.log(`Attempt ${attempt}: not ready — ${result.reason}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.log(`Attempt ${attempt}: not ready — ${message}`);
      }

      await sleep(intervalMs);
    }

    const elapsedSeconds = Math.round((Date.now() - startedAt) / 1000);
    console.error(
      `GraphQL at ${graphqlUrl} not ready after ${elapsedSeconds}s total wait.`,
    );
    process.exit(1);
  } finally {
    clearInterval(heartbeat);
  }
}

waitForGraphqlServer().catch((error) => {
  console.error(error);
  process.exit(1);
});
