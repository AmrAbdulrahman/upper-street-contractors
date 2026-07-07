import { cache } from "react";
import type { Metadata } from "next";
import { PageSection, type PageSectionData } from "@/components/sections/page-section";
import { pageMetaToMetadata } from "@/components/metadata";
import { getSiteMetaConfig } from "@/components/site-meta-config";
import { GetPageDocument } from "@/generated/graphql";
import { query } from "@/lib/cms/query";

const PAGE_KEY = "kitchen-installations-service";
const PAGE_PATH = "/kitchens";

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

export default async function KitchensPage() {
  const data = await getPage();
  const sections = data.pages[0]?.sections ?? [];

  return (
    <>
      {sections.map((section, i) => (
        <PageSection key={i} section={section as PageSectionData} />
      ))}
    </>
  );
}
