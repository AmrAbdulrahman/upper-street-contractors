import { cache } from "react";
import { GetPageMetaDocument } from "@/generated/graphql";
import { getClient } from "@/lib/apollo-server";

async function fetchPageMeta(key: string): Promise<string | null> {
  const { data } = await getClient().query({
    query: GetPageMetaDocument,
    variables: { key },
  });

  const meta = data?.pages?.at(0)?.meta;

  return meta?.documentId ?? null;
}

export const getPageMeta = cache(fetchPageMeta);
