export const STRAPI_HEALTH_QUERY = 'query { __typename }';

export function isHtmlResponse(text) {
  const trimmed = text.trimStart();
  return trimmed.startsWith('<!DOCTYPE') || trimmed.startsWith('<html');
}

export function isGraphqlResponse(body) {
  return (
    typeof body === 'object' &&
    body !== null &&
    ('data' in body || Array.isArray(body.errors))
  );
}

/**
 * @param {{ endpoint: string; headers?: Record<string, string>; signal?: AbortSignal }} options
 * @returns {Promise<{ ready: boolean; reason?: string }>}
 */
export async function pingStrapiGraphql({ endpoint, headers = {}, signal }) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: JSON.stringify({ query: STRAPI_HEALTH_QUERY }),
    signal,
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
