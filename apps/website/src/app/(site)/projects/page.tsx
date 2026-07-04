import { cache } from "react";
import type { Metadata } from "next";
import { ProjectsView } from "@/components/sections/projects";
import { PageSection, type PageSectionData } from "@/components/sections/page-section";
import { pageMetaToMetadata } from "@/components/metadata";
import { getSiteMetaConfig } from "@/components/site-meta-config";
import { GetPageDocument, GetProjectsDocument } from "@/generated/graphql";
import { query } from "@/lib/cms/query";

const PAGE_KEY = "projects";
const PAGE_PATH = "/projects";

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

export default async function ProjectsPage() {
  const [pageData, projectsData] = await Promise.all([
    getPage(),
    query(GetProjectsDocument),
  ]);

  const sections = pageData.pages[0]?.sections ?? [];
  const projects =
    projectsData?.projectCards?.filter(
      (item): item is NonNullable<typeof item> => Boolean(item),
    ) ?? [];

  return (
    <>
      {sections.map((section, i) => (
        <PageSection key={i} section={section as PageSectionData} />
      ))}
      <ProjectsView projects={projects} />
    </>
  );
}
