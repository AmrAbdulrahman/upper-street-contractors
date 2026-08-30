"use client";

import {
  DeleteActionProvider,
  TemplateActionProvider,
  useInspect,
  useZeroCmsWidgetOptional,
} from "@usc/zero-cms-widget";
import { NewEntryButton } from "@/components/cms/new-entry-button";
import { PROJECT_TEMPLATE, saveAsTemplateOptions } from "@/components/cms/templates";
import { useCardFlash } from "@/components/cms/use-card-flash";
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
    const category = project.category?.trim();

    if (!category || seen.has(category)) {
      continue;
    }

    seen.add(category);
    categories.push(category);
  }

  return categories;
}

export function ProjectsView({ projects }: ProjectsViewProps) {
  const categories = useMemo(() => deriveCategories(projects), [projects]);
  const [selectedFilter, setSelectedFilter] = useState(ALL_PROJECTS_LABEL);
  // A Project is queried by Type, so like a Blog Post it has no parent relation
  // field to hang a "+ Add" off — this index had no create affordance at all.
  const widget = useZeroCmsWidgetOptional();
  const inspect = useInspect();
  const { flashId, flashOnClose } = useCardFlash(widget?.isOpen ?? false);

  const filteredProjects =
    selectedFilter === ALL_PROJECTS_LABEL
      ? projects
      : projects.filter((project) => project.category?.trim() === selectedFilter);

  const filterOptions = [ALL_PROJECTS_LABEL, ...categories];

  return (
    <section className="bg-surface">
      <div className="mx-auto max-w-container px-6 py-[88px]">
        {/* Card titles are <h3>s; without this the page jumps h1 → h3. */}
        <h2 className="sr-only">Project case studies</h2>

        {widget ? (
          <NewEntryButton
            label="New project"
            onClick={() =>
              void widget
                .createFromTemplate(PROJECT_TEMPLATE)
                .then(flashOnClose)
            }
          />
        ) : null}

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
            {filteredProjects.map((project) => {
              // Both providers emit no DOM, so each card stays a direct grid item.
              // The title rides in every button's accessible name so a screen
              // reader listing controls doesn't hear the same label once per
              // card with nothing to tell them apart.
              const noun = project.title ? `project “${project.title}”` : "project";

              return inspect && widget ? (
                <TemplateActionProvider
                  key={project.id}
                  value={{ ...saveAsTemplateOptions(PROJECT_TEMPLATE, project.title), noun }}
                >
                  {/* Delete lives on the card, not only on the Project's own
                      page: a Project is queried by Type, so there is no parent
                      relation to unlink it from and no other index affordance
                      that reaches it. The confirm and the "still referenced
                      by …" report come from the widget. The title goes in
                      `label`, not the noun: the confirm prints the noun in a
                      sentence and the title on its own line. */}
                  <DeleteActionProvider value={{ noun: "project", label: project.title }}>
                    <ProjectCard data={project} flash={project.id === flashId} />
                  </DeleteActionProvider>
                </TemplateActionProvider>
              ) : (
                <ProjectCard key={project.id} data={project} />
              );
            })}
          </div>
        ) : (
          <p className="text-base text-muted">No projects in this category.</p>
        )}
      </div>
    </section>
  );
}
