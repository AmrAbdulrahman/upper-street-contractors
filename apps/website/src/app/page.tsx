import type { Metadata } from "next";
import { PageSection } from "@/components/sections";
import { pageMetaToMetadata } from "@/components/metadata";
import { getSiteMetaConfig } from "@/components/site-meta-config";
import { flattenSectionRefs } from "@/helpers/flatten-section-refs";
import { GetHomePageDocument, type GetHomePageQuery } from "@/generated/graphql";
import { strapiRead } from "@/lib/strapi-read";

async function getHomeSections() {
  try {
    const data = await strapiRead<GetHomePageQuery>(GetHomePageDocument);
    const page = data?.pages?.at(0);
    return flattenSectionRefs(page?.section_refs);
  } catch {
    return [];
  }
}

export async function generateMetadata(): Promise<Metadata> {
  try {
    const [siteMetaConfig, data] = await Promise.all([
      getSiteMetaConfig(),
      strapiRead<GetHomePageQuery>(GetHomePageDocument),
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
  const sections = await getHomeSections();

  return (
    <>
      {sections.map((section) => (
        <PageSection key={section.documentId} section={section} />
      ))}
    </>
  );
}
