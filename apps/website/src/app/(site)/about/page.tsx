import { cache } from "react";
import type { Metadata } from "next";
import { PageSections } from "@/components/sections/page-sections";
import { pageMetaToMetadata } from "@/components/metadata";
import { getSiteMetaConfig } from "@/components/site-meta-config";
import { GetPageDocument } from "@/generated/graphql";
import { query } from "@/lib/cms/query";

const PAGE_KEY = "about-us";
const PAGE_PATH = "/about";

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

export default async function AboutPage() {
  const data = await getPage();

  // Nothing page-specific left: this file used to pull the FAQ out of
  // `sections` and re-render it last so it sat below a block of Trustpilot dev
  // scaffolding (both now gone). That hoist was incompatible with the Section
  // builder anyway — it derives insert positions and drag targets from the
  // STORED order, so a rendered order that differs would insert and reorder in
  // the wrong places. Where the FAQ sits is an editor's decision now (drag it).
  return <PageSections page={data.pages[0]} />;
}
