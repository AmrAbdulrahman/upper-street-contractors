import { cache } from "react";
import {
  ProjectActions,
  ProjectCta,
  ProjectGlance,
  ProjectHero,
  SimilarProjects,
} from "@/components/sections/project-detail";
import { PageSection, type PageSectionData } from "@/components/sections/page-section";
import {
  BreadcrumbJsonLd,
  NOT_FOUND_METADATA,
  resolveSocialImages,
} from "@/components/metadata";
import { getSiteMetaConfig } from "@/components/site-meta-config";
import {
  GetProjectBySlugDocument,
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
import { notFound, permanentRedirect } from "next/navigation";

type ProjectPageProps = {
  params: Promise<{ slug: string }>;
};

/**
 * The uuid a Project's URL used to be.
 *
 * Every one of those links — shared, bookmarked, indexed — still has to land on
 * the Project it named, so this segment accepts both shapes and this is how
 * they are told apart. Matched strictly: anything that is not a uuid is a slug,
 * and a mistyped slug should 404 rather than cost an id lookup first.
 */
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Resolved = {
  project: ProjectDetailFragment | null;
  /** Set when the request came in on a uuid and the Project has a real slug. */
  redirectTo: string | null;
};

/**
 * A Project from either half of its address.
 *
 * Slug first: that is the URL now, and the one every internal link builds. The
 * uuid lookup is the compatibility path — a Project created before the slug
 * field existed may still have none, and those keep working on their id.
 *
 * `cache`d because `generateMetadata` and the component both need it, and a
 * Project resolved twice per request is two CMS calls for one answer.
 */
const getProject = cache(async (slug: string): Promise<Resolved> => {
  const bySlug = await query(GetProjectBySlugDocument, { slug });
  const fromSlug = bySlug?.projects?.at(0);
  if (fromSlug) return { project: fromSlug, redirectTo: null };

  if (!UUID.test(slug)) return { project: null, redirectTo: null };

  const byId = await query(GetProjectDocument, { id: slug });
  const project = byId?.project ?? null;
  const canonical = project?.slug?.trim();
  return {
    project,
    redirectTo: canonical ? `/projects/${canonical}` : null,
  };
});

export async function generateStaticParams() {
  const data = await query(GetProjectIdsDocument);

  // Slugs only. The uuids still resolve, but prerendering both would build
  // every Project twice and put two URLs for one page into the output.
  return (data?.projects ?? [])
    .map((item) => item?.slug?.trim())
    .filter((slug): slug is string => Boolean(slug))
    .map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: ProjectPageProps): Promise<Metadata> {
  const { slug } = await params;
  const [siteMetaConfig, resolved] = await Promise.all([
    getSiteMetaConfig(),
    getProject(slug),
  ]);

  const project = resolved.project;
  // An unknown slug gets the Not Found head rather than a generic "Project | …"
  // one (soft-404 signal). The component below still throws; see
  // NOT_FOUND_METADATA.
  if (!project) return NOT_FOUND_METADATA;

  const siteName = siteMetaConfig?.siteName ?? "Upper Street Contractors";
  const title = project.title ?? "Project";
  const description = project?.summary ?? undefined;
  const absoluteTitle = `${title} | ${siteName}`;
  const heroUrl = resolveMediaUrl(project?.hero?.url);
  const { images, twitterImages, card } = resolveSocialImages(
    siteMetaConfig,
    heroUrl,
  );
  // Always the slug URL, even when the request arrived on a uuid: the redirect
  // below moves a visitor, and this is what tells a crawler that the two
  // addresses are one page and which of them to keep.
  const path = resolved.redirectTo ?? `/projects/${slug}`;

  return {
    title: { absolute: absoluteTitle },
    description,
    alternates: { canonical: path },
    openGraph: {
      type: "article",
      locale: "en_GB",
      siteName,
      title: absoluteTitle,
      description,
      url: path,
      images,
    },
    twitter: {
      card,
      title: absoluteTitle,
      description,
      images: twitterImages,
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
  const { slug } = await params;

  const [siteMetaConfig, resolved, allData] = await Promise.all([
    getSiteMetaConfig(),
    getProject(slug),
    query(GetProjectsDocument),
  ]);

  const project = resolved.project;

  if (!project) {
    notFound();
  }

  // A uuid naming a Project that has a slug is an old address for a page with a
  // current one. Permanent, not temporary: the slug is where the URL lives now,
  // and a 307 would ask every crawler to keep checking back.
  if (resolved.redirectTo) {
    permanentRedirect(resolved.redirectTo);
  }

  const allProjects =
    allData?.projects?.filter(
      (p): p is NonNullable<typeof p> => Boolean(p),
    ) ?? [];
  const similar = getSimilarProjects(project, allProjects, 3);
  const sections = project.sections ?? [];

  return (
    <>
      <BreadcrumbJsonLd
        config={siteMetaConfig}
        trail={[
          { name: "Projects", path: "/projects" },
          { name: project.title ?? "Project" },
        ]}
      />
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

      {/* `host` is what gives the strip its pencil — it edits the Project's own
          `similarWork` pins. Outside the provider above on purpose: the strip
          is not one of the Project's sections. */}
      <SimilarProjects projects={similar} host={project} />
      <ProjectCta data={project.cta} />
    </>
  );
}
