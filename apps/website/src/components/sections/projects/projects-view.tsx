"use client";

import { ProjectCard } from "@/components/ui/project-card";
import { ProjectCardFragment } from "@/generated/graphql";
import { useMemo, useState } from "react";

const ALL_PROJECTS_LABEL = "All projects";

type ProjectsViewProps = {
  projects: ProjectCardFragment[];
};

function deriveCategories(projects: ProjectCardFragment[]): string[] {
  const seen = new Set<string>();
  const categories: string[] = [];

  for (const project of projects) {
    const text = project.projectCategory?.text?.trim();

    if (!text || seen.has(text)) {
      continue;
    }

    seen.add(text);
    categories.push(text);
  }

  return categories;
}

export function ProjectsView({ projects }: ProjectsViewProps) {
  const categories = useMemo(() => deriveCategories(projects), [projects]);
  const [selectedFilter, setSelectedFilter] = useState(ALL_PROJECTS_LABEL);

  const filteredProjects =
    selectedFilter === ALL_PROJECTS_LABEL
      ? projects
      : projects.filter(
          (project) => project.projectCategory?.text?.trim() === selectedFilter,
        );

  const filterOptions = [ALL_PROJECTS_LABEL, ...categories];

  return (
    <section className="bg-surface">
      <div className="mx-auto max-w-container px-6 py-[88px]">
        <div
          className="mb-9 flex flex-wrap gap-2"
          role="group"
          aria-label="Filter projects by category"
        >
          {filterOptions.map((label) => {
            const isActive = selectedFilter === label;

            return (
              <button
                key={label}
                type="button"
                aria-pressed={isActive}
                onClick={() => setSelectedFilter(label)}
                className={
                  isActive
                    ? "rounded-full border-[1.5px] border-dark bg-dark px-4 py-2 text-[13px] font-semibold text-white transition-colors"
                    : "rounded-full border-[1.5px] border-border bg-transparent px-4 py-2 text-[13px] font-semibold text-dark transition-colors hover:border-dark hover:bg-dark hover:text-white"
                }
              >
                {label}
              </button>
            );
          })}
        </div>

        {filteredProjects.length > 0 ? (
          <div className="grid gap-[18px] sm:grid-cols-2 lg:grid-cols-3">
            {filteredProjects.map((project) => (
              <ProjectCard key={project.id} data={project} />
            ))}
          </div>
        ) : (
          <p className="text-base text-muted">No projects in this category.</p>
        )}
      </div>
    </section>
  );
}
