import type { Metadata } from "next";
import { pageMetaToMetadata } from "@/components/metadata";
import { getSiteMetaConfig } from "@/components/site-meta-config";
import { PageSections } from "@/components/sections/page-sections";

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
      config: siteMetaConfig,
    });
  } catch {
    const siteMetaConfig = await getSiteMetaConfig();
    return pageMetaToMetadata(null, {
      path: "/",
      config: siteMetaConfig,
    });
  }
}

export default async function Home() {
  const data = await getHomePage();

  return <PageSections page={data.pages[0]} />;
}
