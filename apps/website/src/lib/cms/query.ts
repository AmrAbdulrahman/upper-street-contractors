import "server-only";

import { unstable_cache } from "next/cache";
import { graphql, print } from "graphql";
import type { TypedDocumentNode } from "@graphql-typed-document-node/core";
import { buildCmsSchema } from "@usc/zero-cms-graphql";
import { getZeroCmsReadAdapter } from "@/lib/zero-cms/server";
import { isPreview } from "@/lib/app-env";
import { ZERO_CMS_CACHE_TAG } from "./cache-tag";

/**
 * Reads content from zero-cms by executing a typed document against the
 * generated GraphQL schema in-process (no HTTP — read-only token either way,
 * see server.ts). Uses the read-only adapter for both public rendering and
 * the /admin-mirrored preview routes; which one just depends on Draft Mode.
 *
 * In Draft Mode (reached via /admin/* — see proxy.ts) every read defaults to
 * the draft overlay plus unpublished entries, so editors see work-in-progress.
 * A variable the caller passes explicitly still overrides the default.
 *
 * **Caching**: reads go through `@upstash/redis`, which hits Upstash's REST
 * API via a plain internal `fetch()` Next has no cache instructions for. As
 * of Next 15+, an unconfigured `fetch()` defaults to `no-store` — and per
 * `next build`, that alone was enough to make *every* page calling `query()`
 * come out fully dynamic (verified: zero prerendering, zero ISR caching on
 * reload, even with Draft Mode's own cookie check stubbed out to rule it out
 * as the cause). `unstable_cache` takes over caching semantics for the whole
 * function, so Next stops caring what's inside it. `isPreview()` is
 * necessarily resolved *before* entering the cached region (Request-time APIs
 * can't be read inside one) and decides whether this read bypasses the cache
 * entirely (editors need live data) or gets its own preview-tagged entry.
 */
const PREVIEW_VARS = { status: "draft", includeUnpublished: true } as const;

let schemaPromise: ReturnType<typeof build> | undefined;

async function build() {
  const adapter = await getZeroCmsReadAdapter();
  return buildCmsSchema({ schema: await adapter.getSchema(), adapter });
}

async function runQuery(
  source: string,
  variableValues: Record<string, unknown> | undefined
): Promise<unknown> {
  const schema = await (schemaPromise ??= build());
  const result = await graphql({ schema, source, variableValues });
  if (result.errors?.length)
    throw new Error(result.errors.map((e) => e.message).join("; "));
  // graphql-js builds result objects with null prototypes; deep-plain them so
  // they can cross the Server -> Client component boundary, and so it's a
  // plain JSON-serializable value unstable_cache can actually persist.
  return JSON.parse(JSON.stringify(result.data ?? null));
}

export async function query<TData, TVariables>(
  doc: TypedDocumentNode<TData, TVariables>,
  variables?: TVariables,
  opts?: { revalidate?: number; cacheInInspect?: boolean }
): Promise<TData> {
  const preview = await isPreview();
  const variableValues = preview
    ? { ...PREVIEW_VARS, ...(variables ?? {}) }
    : (variables as Record<string, unknown> | undefined);
  const source = print(doc);

  // Editors previewing draft content need it live on every request, not a
  // stale cached snapshot — bypass the cache entirely, unless the caller
  // opts in (e.g. a site-wide singleton like site-meta-config: rarely
  // changes and isn't user-scoped, so the same cached value is fine even
  // while previewing).
  if (preview && !opts?.cacheInInspect) {
    return runQuery(source, variableValues) as Promise<TData>;
  }

  const cached = unstable_cache(runQuery, [preview ? "preview" : "public"], {
    // Content only actually changes on publish/unpublish/delete/etc., which
    // already calls revalidateTag(ZERO_CMS_CACHE_TAG) (see server.ts's
    // withRevalidate) — `revalidate: false` (the default here) means "cached
    // until that on-demand invalidation fires", not "never refreshes".
    revalidate: opts?.revalidate ?? false,
    tags: [ZERO_CMS_CACHE_TAG],
  });
  return cached(source, variableValues) as Promise<TData>;
}
