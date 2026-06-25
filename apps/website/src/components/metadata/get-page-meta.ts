import { cache } from "react";
import { GetPageMetaDocument, type GetPageMetaQuery } from "@/generated/graphql";
import { strapiRead } from "@/lib/strapi-read";

async function fetchPageMeta(key: string): Promise<string | null> {
  const data = await strapiRead<GetPageMetaQuery>(GetPageMetaDocument, { key });
  const meta = data?.pages?.at(0)?.meta;
  return meta?.documentId ?? null;
}

export const getPageMeta = cache(fetchPageMeta);
