import { cache } from "react";
import {
  GetSiteMetaConfigDocument,
  type SiteMetaConfigFragment,
} from "@/generated/graphql";
import { getClient } from "@/lib/apollo-server";

async function fetchSiteMetaConfig(): Promise<SiteMetaConfigFragment | null> {
  try {
    const { data } = await getClient().query({
      query: GetSiteMetaConfigDocument,
      errorPolicy: "ignore",
    });

    return data?.siteMetaConfigs?.at(0) ?? null;
  } catch {
    return null;
  }
}

export const getSiteMetaConfig = cache(fetchSiteMetaConfig);
