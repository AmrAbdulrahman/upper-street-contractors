import { cache } from "react";
import {
  GetSiteMetaConfigDocument,
  type GetSiteMetaConfigQuery,
  type SiteMetaConfigFragment,
} from "@/generated/graphql";
import { strapiRead } from "@/lib/strapi-read";

async function fetchSiteMetaConfig(): Promise<SiteMetaConfigFragment | null> {
  try {
    const data = await strapiRead<GetSiteMetaConfigQuery>(GetSiteMetaConfigDocument);
    return data?.siteMetaConfigs?.at(0) ?? null;
  } catch {
    return null;
  }
}

export const getSiteMetaConfig = cache(fetchSiteMetaConfig);
