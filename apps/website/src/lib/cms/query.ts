import "server-only";

import { graphql, print } from "graphql";
import type { TypedDocumentNode } from "@graphql-typed-document-node/core";
import { buildCmsSchema } from "@usc/zero-cms-graphql";
import { getZeroCmsAdapter } from "@/lib/zero-cms/server";
import { isPreview } from "@/lib/app-env";

/**
 * Reads published content from zero-cms by executing a typed document against the
 * generated GraphQL schema in-process (no HTTP, no auth — published is public).
 *
 * In a preview deploy (`NEXT_PUBLIC_APP_ENV=preview`) every read defaults to the draft overlay
 * plus unpublished entries, so editors see work-in-progress. A variable the caller
 * passes explicitly still overrides the preview default.
 */
const PREVIEW_VARS = { status: "draft", includeUnpublished: true } as const;

let schemaPromise: ReturnType<typeof build> | undefined;

async function build() {
  const adapter = await getZeroCmsAdapter();
  return buildCmsSchema({ schema: await adapter.getSchema(), adapter });
}

export async function query<TData, TVariables>(
  doc: TypedDocumentNode<TData, TVariables>,
  variables?: TVariables,
  opts?: { revalidate?: number; cacheInInspect?: boolean }
): Promise<TData> {
  const schema = await (schemaPromise ??= build());
  const variableValues = isPreview()
    ? { ...PREVIEW_VARS, ...(variables ?? {}) }
    : (variables as Record<string, unknown> | undefined);
  const result = await graphql({
    schema,
    source: print(doc),
    variableValues: variableValues as Record<string, unknown> | undefined,
    contextValue: {
      revalidate: opts?.revalidate,
      cacheInInspect: opts?.cacheInInspect,
    },
  });
  if (result.errors?.length)
    throw new Error(result.errors.map((e) => e.message).join("; "));
  // graphql-js builds result objects with null prototypes; deep-plain them so they
  // can cross the Server -> Client component boundary.
  return JSON.parse(JSON.stringify(result.data ?? null)) as TData;
}
