import { cache } from "react";
import { GetPageMetaDocument } from "@/generated/graphql";
import { query } from "@/lib/cms/query";

async function fetchPageMeta(key: string): Promise<string | null> {
  const data = await query(GetPageMetaDocument, { key });
  const meta = data?.pages?.at(0)?.meta;
  return meta?.id ?? null;
}

export const getPageMeta = cache(fetchPageMeta);
