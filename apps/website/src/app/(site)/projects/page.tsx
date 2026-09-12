import { cache } from "react";
import type { Metadata } from "next";
import { ProjectsView } from "@/components/sections/projects";
import { PageSections } from "@/components/sections/page-sections";
import { BreadcrumbJsonLd, pageMetaToMetadata } from "@/components/metadata";
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
      config: siteMetaConfig,
    });
  } catch {
    const siteMetaConfig = await getSiteMetaConfig();
    return pageMetaToMetadata(null, {
      path: PAGE_PATH,
      config: siteMetaConfig,
    });
  }
}

export default async function ProjectsPage() {
  const [siteMetaConfig, pageData, projectsData] = await Promise.all([
    getSiteMetaConfig(),
    getPage(),
    query(GetProjectsDocument),
  ]);

  const projects =
    projectsData?.projects?.filter(
      (item): item is NonNullable<typeof item> => Boolean(item),
    ) ?? [];

  return (
    <>
      <BreadcrumbJsonLd config={siteMetaConfig} trail={[{ name: "Projects" }]} />
      <PageSections page={pageData.pages[0]} />
      <ProjectsView projects={projects} />
    </>
  );
}
