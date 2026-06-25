import { unstable_cache } from 'next/cache';
import { print } from 'graphql';
import type { DocumentNode } from 'graphql';
import { addTypenameToDocument } from '@apollo/client/utilities';
import { isStrapiInspectionEnabled } from '@/components/metadata/is-strapi-inspection-enabled';
import {
  getStrapiAuthHeaders,
  getServiceAuthHeaders,
  getStrapiGraphqlEndpoint,
} from '@/lib/strapi-auth';
import { recordCmsCall } from '@/lib/dev/cms-call-collector';

const isDev = process.env.NODE_ENV === 'development';

// We print raw documents and POST them ourselves, so Apollo's automatic
// __typename injection never runs. Without it, only explicitly-selected
// __typename (e.g. on dynamic-zone unions) comes back — nested relation entries
// (project cards, badges, buttons) arrive without it, and the inline editor
// can't resolve their content type. Mirror Apollo: add __typename everywhere.
// Memoised per document (generated DocumentNodes are stable module constants).
const printCache = new WeakMap<DocumentNode, string>();
function printWithTypename(doc: DocumentNode): string {
  let printed = printCache.get(doc);
  if (printed === undefined) {
    printed = print(addTypenameToDocument(doc));
    printCache.set(doc, printed);
  }
  return printed;
}

async function postGraphql(
  endpoint: string,
  query: string,
  variables: Record<string, unknown>,
  headers: Record<string, string>,
  cache: RequestCache,
): Promise<unknown> {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({ query, variables }),
    cache,
  });
  if (!res.ok) throw new Error(`Strapi GraphQL ${res.status}: ${res.statusText}`);
  const json = (await res.json()) as { data?: unknown };
  return json.data;
}

/**
 * Centralised Strapi GraphQL read with cache/live split:
 * - Inspect (editor DRAFT): raw no-store fetch with editor JWT.
 * - Public (PUBLISHED): unstable_cache with `tags:['strapi'], revalidate:3600`.
 *   Invalidated on publish via revalidateTag('strapi').
 *
 * Call `revalidateTag('strapi')` (in server actions or /api/revalidate) to flush.
 */
export async function strapiRead<TData>(
  doc: DocumentNode,
  variables?: Record<string, unknown>,
  { revalidate = 3600 }: { revalidate?: number } = {},
): Promise<TData> {
  const inspect = await isStrapiInspectionEnabled();
  const endpoint = getStrapiGraphqlEndpoint();
  const query = printWithTypename(doc);
  const opName =
    (doc.definitions[0] as { name?: { value?: string } })?.name?.value ?? 'unknown';

  if (inspect) {
    // DRAFT reads always hit Strapi (no-store).
    const started = isDev ? Date.now() : 0;
    let ok = true;
    try {
      const authHeaders = await getStrapiAuthHeaders();
      return (await postGraphql(
        endpoint,
        query,
        { ...variables, status: 'DRAFT' },
        authHeaders,
        'no-store',
      )) as TData;
    } catch (err) {
      ok = false;
      throw err;
    } finally {
      if (isDev) {
        recordCmsCall({
          kind: 'graphql',
          op: opName,
          status: 'DRAFT',
          network: true,
          ok,
          durationMs: Date.now() - started,
        });
      }
    }
  }

  // PUBLISHED reads go through unstable_cache: the inner fn (and `didNetwork`)
  // only runs on a cache MISS, so it doubles as the real-HTTP-vs-cached flag.
  let didNetwork = false;
  const cachedFn = unstable_cache(
    async () => {
      didNetwork = true;
      const authHeaders = await getServiceAuthHeaders();
      return postGraphql(
        endpoint,
        query,
        { ...variables, status: 'PUBLISHED' },
        authHeaders,
        'no-store',
      );
    },
    [opName, JSON.stringify(variables ?? {})],
    { tags: ['strapi'], revalidate },
  );

  const started = isDev ? Date.now() : 0;
  let ok = true;
  try {
    return (await cachedFn()) as TData;
  } catch (err) {
    ok = false;
    throw err;
  } finally {
    if (isDev) {
      recordCmsCall({
        kind: 'graphql',
        op: opName,
        status: 'PUBLISHED',
        network: didNetwork,
        ok,
        durationMs: didNetwork ? Date.now() - started : 0,
      });
    }
  }
}
