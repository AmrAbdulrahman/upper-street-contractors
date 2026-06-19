export const STRAPI_HEALTH_QUERY = "query { __typename }";

export type StrapiHealthResult = {
  ready: boolean;
  reason?: string;
};

export function isHtmlResponse(text: string): boolean {
  const trimmed = text.trimStart();
  return trimmed.startsWith("<!DOCTYPE") || trimmed.startsWith("<html");
}

export function isGraphqlResponse(body: unknown): body is Record<string, unknown> {
  return (
    typeof body === "object" &&
    body !== null &&
    ("data" in body || Array.isArray((body as { errors?: unknown }).errors))
  );
}

export async function pingStrapiGraphql({
  endpoint,
  headers = {},
  signal,
}: {
  endpoint: string;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}): Promise<StrapiHealthResult> {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
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

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return { ready: false, reason: "Non-JSON response" };
  }

  if (isGraphqlResponse(body)) {
    return { ready: true };
  }

  return { ready: false, reason: "Unexpected GraphQL response shape" };
}

const LOCAL_STRAPI_PATTERN = /localhost|127\.0\.0\.1/;

export function isRemoteStrapiUrl(url: string): boolean {
  return !LOCAL_STRAPI_PATTERN.test(url);
}

export function getPublicStrapiGraphqlEndpoint(): string {
  const base = (
    process.env.NEXT_PUBLIC_STRAPI_URL ??
    process.env.STRAPI_URL ??
    "http://localhost:1337"
  ).replace(/\/+$/, "");

  return `${base}/graphql`;
}

export function shouldEnableColdStartGate(
  strapiUrl: string,
  emulateColdStart: boolean,
): boolean {
  if (emulateColdStart) {
    return true;
  }

  return isRemoteStrapiUrl(strapiUrl);
}
