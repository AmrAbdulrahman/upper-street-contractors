import type { Metadata } from "next";
import { PageSection } from "@/components/sections";
import { pageMetaToMetadata } from "@/components/metadata";
import { getSiteMetaConfig } from "@/components/site-meta-config";
import { flattenSectionRefs } from "@/helpers/flatten-section-refs";
import { GetHomePageDocument } from "@/generated/graphql";
import { getClient } from "@/lib/apollo-server";

export async function generateMetadata(): Promise<Metadata> {
  const [siteMetaConfig, { data }] = await Promise.all([
    getSiteMetaConfig(),
    getClient().query({ query: GetHomePageDocument }),
  ]);

  const page = data?.pages?.at(0);

  return pageMetaToMetadata(page?.meta, {
    path: "/",
    siteName: siteMetaConfig?.siteName ?? undefined,
  });
}

export default async function Home() {
  const { data } = await getClient().query({
    query: GetHomePageDocument,
  });

  const page = data?.pages?.at(0);
  const sections = flattenSectionRefs(page?.section_refs);

  return (
    <>
      {sections.map((section) => (
        <PageSection key={section.documentId} section={section} />
      ))}
    </>
  );
}
