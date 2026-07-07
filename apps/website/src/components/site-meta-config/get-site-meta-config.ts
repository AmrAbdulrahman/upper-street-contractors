import { cache } from "react";
import {
  GetSiteMetaConfigDocument,
  type SiteMetaConfigFragment,
} from "@/generated/graphql";
import { query } from "@/lib/cms/query";

async function fetchSiteMetaConfig(): Promise<SiteMetaConfigFragment | null> {
  try {
    // Global chrome (header/footer/metadata/robots), rarely changes. Cache it
    // even in inspect mode (safe: it's a non-user-scoped singleton) so it costs
    // at most one CMS call per 10 min across all renders. Flushed on publish via
    // revalidateCms() (see lib/cms/revalidate.ts).
    const data = await query(
      GetSiteMetaConfigDocument,
      undefined,
      { revalidate: 600, cacheInInspect: true },
    );
    return data?.siteMetaConfigs?.at(0) ?? null;
  } catch {
    return null;
  }
}

export const getSiteMetaConfig = cache(fetchSiteMetaConfig);
