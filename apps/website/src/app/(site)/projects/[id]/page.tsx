import { Badge, badgePropsFromStrapi } from "@/components/ui/badge";
import { ProjectBanner } from "@/components/ui/project-card";
import { getSiteMetaConfig } from "@/components/site-meta-config";
import {
  GetProjectCardDocument,
  GetProjectCardIdsDocument,
} from "@/generated/graphql";
import { query } from "@/lib/cms/query";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

type ProjectPageProps = {
  params: Promise<{ id: string }>;
};

export async function generateStaticParams() {
  const data = await query(GetProjectCardIdsDocument);

  return (
    data?.projectCards
      ?.filter((item) => item?.id)
      .map((item) => ({ id: item!.id })) ?? []
  );
}

export async function generateMetadata({
  params,
}: ProjectPageProps): Promise<Metadata> {
  const { id } = await params;
  const [siteMetaConfig, data] = await Promise.all([
    getSiteMetaConfig(),
    query(GetProjectCardDocument, { id }),
  ]);

  const project = data?.projectCard;
  const siteName = siteMetaConfig?.siteName ?? "Upper Street Contractors";
  const title = project?.title ?? "Project";
  const description = project?.description ?? undefined;
  const absoluteTitle = `${title} | ${siteName}`;

  return {
    title: { absolute: absoluteTitle },
    description,
    alternates: {
      canonical: `/projects/${id}`,
    },
    openGraph: {
      title: absoluteTitle,
      description,
      url: `/projects/${id}`,
    },
    twitter: {
      title: absoluteTitle,
      description,
    },
  };
}

export default async function ProjectPage({ params }: ProjectPageProps) {
  const { id } = await params;

  const data = await query(GetProjectCardDocument, { id });

  const project = data?.projectCard;

  if (!project) {
    notFound();
  }

  const badges = project.projectBadges?.filter(Boolean) ?? [];

  return (
    <div className="mx-auto max-w-container px-6 py-20">
      <Link
        href="/projects"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-gold hover:underline"
      >
        ← Back to projects
      </Link>

      <div className="mt-8 max-w-3xl">
        <ProjectBanner
          banner={project.projectBanner}
          category={project.projectCategory}
          heightClassName="h-[280px]"
          rounded
          imageSizes="(max-width: 1024px) 100vw, 960px"
          priority
        />

        {badges.length > 0 ? (
          <div className="mt-6 flex flex-wrap gap-1.5">
            {badges.map((badge) => {
              if (!badge) {
                return null;
              }

              const badgeProps = badgePropsFromStrapi(badge, {
                stripHref: true,
                className: "border border-border bg-surface text-subtle",
              });

              if (!badgeProps) {
                return null;
              }

              return <Badge key={badge.id} {...badgeProps} />;
            })}
          </div>
        ) : null}

        {project.title ? (
          <h1 className="mt-6 font-serif text-4xl leading-tight text-dark">
            {project.title}
          </h1>
        ) : null}

        {project.description ? (
          <p className="mt-4 text-lg leading-relaxed text-muted">
            {project.description}
          </p>
        ) : null}
      </div>
    </div>
  );
}
