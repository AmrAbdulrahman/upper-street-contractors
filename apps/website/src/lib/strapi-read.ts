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
 * - Inspect (editor DRAFT): raw no-store fetch with editor JWT — always fresh.
 * - Public (PUBLISHED): unstable_cache with `tags:['strapi'], revalidate:3600`.
 *   Invalidated on publish via revalidateTag('strapi').
 *
 * `cacheInInspect` lets a read be cached even in inspect mode (DRAFT), to avoid
 * refetching global chrome on every render/refresh. SAFE ONLY for global,
 * non-user-scoped singletons (e.g. SiteMetaConfig): the cache key has no user
 * dimension and the DRAFT fetch uses the editor JWT, so a per-editor query would
 * leak one editor's content to another. Never set it for per-entry content.
 *
 * Call `revalidateTag('strapi')` (in server actions or /api/revalidate) to flush.
 */
export async function strapiRead<TData>(
  doc: DocumentNode,
  variables?: Record<string, unknown>,
  { revalidate = 3600, cacheInInspect = false }: {
    revalidate?: number;
    cacheInInspect?: boolean;
  } = {},
): Promise<TData> {
  const inspect = await isStrapiInspectionEnabled();
  const endpoint = getStrapiGraphqlEndpoint();
  const query = printWithTypename(doc);
  const opName =
    (doc.definitions[0] as { name?: { value?: string } })?.name?.value ?? 'unknown';
  const status: 'DRAFT' | 'PUBLISHED' = inspect ? 'DRAFT' : 'PUBLISHED';

  // DRAFT reads bypass the cache by default (editors must see live drafts); opt
  // back in via cacheInInspect. PUBLISHED reads always go through unstable_cache.
  const useCache = !inspect || cacheInInspect;

  // Inner fetch sets `didNetwork`, so when wrapped by unstable_cache it only flips
  // on a cache MISS — doubling as the real-HTTP-vs-cached flag for the meter.
  let didNetwork = false;
  const fetchData = async () => {
    didNetwork = true;
    const authHeaders = inspect
      ? await getStrapiAuthHeaders()
      : await getServiceAuthHeaders();
    return postGraphql(endpoint, query, { ...variables, status }, authHeaders, 'no-store');
  };

  const run = useCache
    ? unstable_cache(
        fetchData,
        [opName, JSON.stringify(variables ?? {}), status],
        { tags: ['strapi'], revalidate },
      )
    : fetchData;

  const started = isDev ? Date.now() : 0;
  let ok = true;
  try {
    return (await run()) as TData;
  } catch (err) {
    ok = false;
    throw err;
  } finally {
    if (isDev) {
      // Uncached path always hits the network; cached path only on a miss.
      const network = useCache ? didNetwork : true;
      recordCmsCall({
        kind: 'graphql',
        op: opName,
        status,
        network,
        ok,
        durationMs: network ? Date.now() - started : 0,
      });
    }
  }
}
