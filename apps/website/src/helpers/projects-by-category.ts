import type { ProjectCardFragment } from "@/generated/graphql";

/**
 * Service-page case studies: the Projects whose Category matches `category`,
 * most recently completed first, capped at `limit`. Returns all (sorted) when
 * no category is given.
 */
export function projectsByCategory(
  projects: ProjectCardFragment[],
  category?: string | null,
  limit = 3,
): ProjectCardFragment[] {
  const matches = category
    ? projects.filter((project) => project.category === category)
    : projects;

  return [...matches]
    .sort((a, b) => (b.endDate ?? "").localeCompare(a.endDate ?? ""))
    .slice(0, limit);
}
