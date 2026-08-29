import { cache } from "react";
import type { Metadata } from "next";
import { PageSections } from "@/components/sections/page-sections";
import { pageMetaToMetadata } from "@/components/metadata";
import { getSiteMetaConfig } from "@/components/site-meta-config";
import { GetPageDocument } from "@/generated/graphql";
import { query } from "@/lib/cms/query";

/**
 * The Services index — the hub the header's Services menu and the footer's
 * Services link both point at. Structurally identical to the nine Service pages
 * it links: a CMS `page` rendered by `<PageSections>`, with the card grid
 * itself a `service-grid-section` block rather than route code.
 */
const PAGE_KEY = "services";
const PAGE_PATH = "/services";

const getPage = cache(() => query(GetPageDocument, { key: PAGE_KEY }));

export async function generateMetadata(): Promise<Metadata> {
  try {
    const [siteMetaConfig, data] = await Promise.all([
      getSiteMetaConfig(),
      getPage(),
    ]);
    return pageMetaToMetadata(data?.pages?.at(0)?.meta, {
      path: PAGE_PATH,
      siteName: siteMetaConfig?.siteName ?? undefined,
    });
  } catch {
    const siteMetaConfig = await getSiteMetaConfig();
    return pageMetaToMetadata(null, {
      path: PAGE_PATH,
      siteName: siteMetaConfig?.siteName ?? undefined,
    });
  }
}

export default async function ServicesPage() {
  const data = await getPage();

  return <PageSections page={data.pages[0]} />;
}
