"use server";

import { getPageMeta } from "./get-page-meta";

export async function getPageMetaId(key: string): Promise<string | null> {
  return getPageMeta(key);
}
