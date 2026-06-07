import { cache } from "react";
import {
  GetSiteMetaConfigDocument,
  type SiteMetaConfigFragment,
} from "@/generated/graphql";
import { getClient } from "@/lib/apollo-server";

async function fetchSiteMetaConfig(): Promise<SiteMetaConfigFragment | null> {
  const { data } = await getClient().query({
    query: GetSiteMetaConfigDocument,
  });

  return data?.siteMetaConfigCollection?.items?.at(0) ?? null;
}

export const getSiteMetaConfig = cache(fetchSiteMetaConfig);
