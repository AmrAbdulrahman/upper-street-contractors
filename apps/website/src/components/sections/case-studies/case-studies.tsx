import { SimilarProjects } from "@/components/sections/project-detail";
import {
  type CaseStudiesSectionFragment,
  GetProjectsDocument,
} from "@/generated/graphql";
import { projectsByCategory } from "@/helpers/projects-by-category";
import { query } from "@/lib/cms/query";

type CaseStudiesSectionProps = {
  data: CaseStudiesSectionFragment;
};

/**
 * Service-page "case studies" strip. Self-queries all Projects and shows the
 * ones matching the section's Category (most recent first), reusing the
 * display-only SimilarProjects card grid with CMS-driven headings.
 */
export async function CaseStudiesSection({ data }: CaseStudiesSectionProps) {
  const { overline, title, category } = data;

  const projectsData = await query(GetProjectsDocument);
  const all =
    projectsData?.projects?.filter(
      (p): p is NonNullable<typeof p> => Boolean(p),
    ) ?? [];
  const projects = projectsByCategory(all, category, 3);

  return (
    <SimilarProjects
      projects={projects}
      overline={overline ?? "Case studies"}
      title={title ?? "Projects we've delivered"}
    />
  );
}
