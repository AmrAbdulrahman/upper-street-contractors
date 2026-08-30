import {
  ProjectActions,
  ProjectCta,
  ProjectGlance,
  ProjectHero,
  SimilarProjects,
} from "@/components/sections/project-detail";
import { PageSection, type PageSectionData } from "@/components/sections/page-section";
import { getSiteMetaConfig } from "@/components/site-meta-config";
import {
  GetProjectDocument,
  GetProjectIdsDocument,
  GetProjectsDocument,
  type ProjectDetailFragment,
} from "@/generated/graphql";
import { getSimilarProjects } from "@/helpers/similar-projects";
import { resolveMediaUrl } from "@/helpers/media-url";
import { query } from "@/lib/cms/query";
import { ZeroCmsEntryProvider, ZeroCmsSectionList } from "@usc/zero-cms-widget";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

type ProjectPageProps = {
  params: Promise<{ id: string }>;
};

export async function generateStaticParams() {
  const data = await query(GetProjectIdsDocument);

  return (
    data?.projects?.filter((item) => item?.id).map((item) => ({ id: item!.id })) ??
    []
  );
}

export async function generateMetadata({
  params,
}: ProjectPageProps): Promise<Metadata> {
  const { id } = await params;
  const [siteMetaConfig, data] = await Promise.all([
    getSiteMetaConfig(),
    query(GetProjectDocument, { id }),
  ]);

  const project = data?.project;
  // No fallback title: an unknown id must render as a 404, not leak a
  // generic "Project | …" title on the not-found page (soft-404 signal).
  if (!project) notFound();
  const siteName = siteMetaConfig?.siteName ?? "Upper Street Contractors";
  const title = project.title ?? "Project";
  const description = project?.summary ?? undefined;
  const absoluteTitle = `${title} | ${siteName}`;
  const heroUrl = resolveMediaUrl(project?.hero?.url);

  return {
    title: { absolute: absoluteTitle },
    description,
    alternates: { canonical: `/projects/${id}` },
    openGraph: {
      title: absoluteTitle,
      description,
      url: `/projects/${id}`,
      ...(heroUrl ? { images: [heroUrl] } : {}),
    },
    twitter: {
      title: absoluteTitle,
      description,
      card: heroUrl ? "summary_large_image" : "summary",
    },
  };
}

/**
 * How many Deliverables this Project lists, for the "Scope items" stat.
 *
 * Read off the Project's own What We Delivered section rather than a field:
 * `deliverables` moved into that section (ADR 0022), and the glance band is
 * derived chrome that has no other way to see it. Nothing if the editor has not
 * placed one — the stat simply drops out.
 */
function scopeCountOf(sections: ProjectDetailFragment["sections"]): number {
  let count = 0;
  for (const section of sections ?? []) {
    if (section?.__typename === "ProjectScopeSection")
      count += (section.deliverables ?? []).length;
  }
  return count;
}

export default async function ProjectPage({ params }: ProjectPageProps) {
  const { id } = await params;

  const [data, allData] = await Promise.all([
    query(GetProjectDocument, { id }),
    query(GetProjectsDocument),
  ]);

  const project = data?.project;

  if (!project) {
    notFound();
  }

  const allProjects =
    allData?.projects?.filter(
      (p): p is NonNullable<typeof p> => Boolean(p),
    ) ?? [];
  const similar = getSimilarProjects(project, allProjects, 3);
  const sections = project.sections ?? [];

  return (
    <>
      {/* Provider, not <ZeroCmsEntry>: the Section builder needs the Project's
          id and type in context, but an outline + pencil around the whole page
          would swallow every section's own affordance. The same shape a Blog
          Post page has had since a post became a list of sections. */}
      <ZeroCmsEntryProvider entry={project}>
        <div className="mx-auto max-w-container px-6 pt-6 empty:hidden">
          <ProjectActions title={project.title} />
        </div>

        <ProjectHero project={project} />

        <ProjectGlance
          project={project}
          scopeCount={scopeCountOf(sections)}
          sidebarCta={project.sidebarCta}
        />

        <ZeroCmsSectionList field="sections" items={sections}>
          {sections.map((section, i) => (
            <PageSection key={i} section={section as PageSectionData} />
          ))}
        </ZeroCmsSectionList>
      </ZeroCmsEntryProvider>

      <SimilarProjects projects={similar} />
      <ProjectCta data={project.cta} />
    </>
  );
}
