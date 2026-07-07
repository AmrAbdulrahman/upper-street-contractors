import {
  ProjectCta,
  ProjectGlance,
  ProjectHero,
  ProjectScope,
  ProjectTimeline,
  SimilarProjects,
} from "@/components/sections/project-detail";
import { getSiteMetaConfig } from "@/components/site-meta-config";
import {
  GetProjectDocument,
  GetProjectIdsDocument,
  GetProjectsDocument,
} from "@/generated/graphql";
import { getSimilarProjects } from "@/helpers/similar-projects";
import { resolveMediaUrl } from "@/helpers/media-url";
import { query } from "@/lib/cms/query";
import { ZeroCmsEntry, ZeroCmsEntryField } from "@usc/zero-cms-widget";
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
  const siteName = siteMetaConfig?.siteName ?? "Upper Street Contractors";
  const title = project?.title ?? "Project";
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

  const comments = (project.clientComments ?? []).filter(
    (c): c is NonNullable<typeof c> => Boolean(c),
  );
  const pullQuote = comments[0] ?? null;
  const miniQuote = comments[1] ?? null;

  return (
    <>
      <ZeroCmsEntry entry={project}>
        <ProjectHero project={project} />

        <section className="bg-surface">
          <div className="mx-auto max-w-container px-6 py-[72px] pb-20">
            <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-14">
              <div>
                <ProjectScope
                  summary={project.deliveredSummary}
                  deliverables={project.deliverables}
                />

                {pullQuote?.comment ? (
                  <ZeroCmsEntry entry={pullQuote}>
                    <figure className="mt-10 rounded-2xl border border-border border-l-4 border-l-gold bg-white p-6 shadow-sm">
                      <ZeroCmsEntryField field="comment">
                        <blockquote className="text-base leading-relaxed text-dark/85 italic">
                          {`“${pullQuote.comment}”`}
                        </blockquote>
                      </ZeroCmsEntryField>
                      {pullQuote.name ? (
                        <ZeroCmsEntryField field="name">
                          <figcaption className="mt-3 text-sm font-semibold text-dark">
                            {`— ${pullQuote.name}`}
                          </figcaption>
                        </ZeroCmsEntryField>
                      ) : null}
                    </figure>
                  </ZeroCmsEntry>
                ) : null}

                <ProjectTimeline steps={project.projectTimeline} />
              </div>

              <aside>
                <ProjectGlance
                  project={project}
                  quote={miniQuote}
                  sidebarCta={project.sidebarCta}
                />
              </aside>
            </div>
          </div>
        </section>
      </ZeroCmsEntry>

      <SimilarProjects projects={similar} />
      <ProjectCta data={project.cta} />
    </>
  );
}
