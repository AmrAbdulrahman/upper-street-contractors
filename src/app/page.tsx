import type { Metadata } from "next";
import { PageSection } from "@/components/sections";
import { pageMetaToMetadata } from "@/components/metadata";
import { getSiteMetaConfig } from "@/components/site-meta-config";
import { GetHomePageDocument } from "@/generated/graphql";
import { getClient } from "@/lib/apollo-server";

export async function generateMetadata(): Promise<Metadata> {
  const [siteMetaConfig, { data }] = await Promise.all([
    getSiteMetaConfig(),
    getClient().query({ query: GetHomePageDocument }),
  ]);

  const page = data?.pageCollection?.items?.at(0);

  return pageMetaToMetadata(page?.meta, {
    path: "/",
    siteName: siteMetaConfig?.siteName ?? undefined,
  });
}

export default async function Home() {
  const { data } = await getClient().query({
    query: GetHomePageDocument,
  });

  const page = data?.pageCollection?.items?.at(0);
  const sections = page?.sectionsCollection?.items ?? [];

  return (
    <>
      {sections.map((section) =>
        section ? (
          <PageSection key={section._id} section={section} />
        ) : null,
      )}
    </>
  );
}
