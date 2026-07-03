import type { Metadata } from "next";
import { pageMetaToMetadata } from "@/components/metadata";
import { getSiteMetaConfig } from "@/components/site-meta-config";
import { PageSection, type PageSectionData } from "@/components/sections/page-section";

import { cache } from "react";
import { GetHomePageDocument } from "@/generated/graphql";
import { query } from "@/lib/cms/query";

const getHomePage = cache(() =>
  query(GetHomePageDocument),
);

export async function generateMetadata(): Promise<Metadata> {
  try {
    const [siteMetaConfig, data] = await Promise.all([
      getSiteMetaConfig(),
      getHomePage(),
    ]);

    const page = data?.pages?.at(0);

    return pageMetaToMetadata(page?.meta, {
      path: "/",
      siteName: siteMetaConfig?.siteName ?? undefined,
    });
  } catch {
    const siteMetaConfig = await getSiteMetaConfig();
    return pageMetaToMetadata(null, {
      path: "/",
      siteName: siteMetaConfig?.siteName ?? undefined,
    });
  }
}

export default async function Home() {
  const data = await getHomePage();
  const sections = data.pages[0]?.sections ?? [];

  return (
    <>
      {sections.map((section, i) => (
        <PageSection key={i} section={section as PageSectionData} />
      ))}
    </>
  );
}
