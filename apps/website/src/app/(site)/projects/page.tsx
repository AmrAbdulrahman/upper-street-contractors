import {
  ProjectsHeroPlaceholder,
  ProjectsView,
} from "@/components/sections/projects";
import { getSiteMetaConfig } from "@/components/site-meta-config";
import { GetProjectsDocument } from "@/generated/graphql";
import { query } from "@/lib/cms/query";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const siteMetaConfig = await getSiteMetaConfig();
  const siteName = siteMetaConfig?.siteName ?? "Upper Street Contractors";
  const title = "Projects";
  const description =
    "Bathrooms, kitchens and home refurbishments delivered across Islington and nearby areas.";
  const absoluteTitle = `${title} | ${siteName}`;

  return {
    title: { absolute: absoluteTitle },
    description,
    alternates: {
      canonical: "/projects",
    },
    openGraph: {
      title: absoluteTitle,
      description,
      url: "/projects",
    },
    twitter: {
      title: absoluteTitle,
      description,
    },
  };
}

export default async function ProjectsPage() {
  const data = await query(GetProjectsDocument);

  const projects =
    data?.projectCards?.filter((item): item is NonNullable<typeof item> =>
      Boolean(item),
    ) ?? [];

  return (
    <>
      <ProjectsHeroPlaceholder />
      <ProjectsView projects={projects} />
    </>
  );
}
