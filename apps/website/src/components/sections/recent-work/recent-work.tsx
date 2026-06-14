import {
  AddStrapiEntry,
  StrapiEntry,
  StrapiEntryField,
} from "@/components/strapi";
import { Button } from "@/components/ui/button";
import { ProjectCard } from "@/components/ui/project-card";
import { RecentWorkSectionFragment } from "@/generated/graphql";

type RecentWorkSectionProps = {
  data: RecentWorkSectionFragment;
};

export function RecentWorkSection({ data }: RecentWorkSectionProps) {
  const { overline, title, description, projects, viewAllProjects } = data;
  const projectItems = projects?.filter(Boolean) ?? [];

  return (
    <StrapiEntry entry={data}>
      <section className="bg-white">
        <div className="mx-auto max-w-container px-6 py-[88px]">
          <div className="mx-auto max-w-2xl text-center">
            {overline ? (
              <StrapiEntryField field="overline">
                <p className="text-[11px] font-bold tracking-[0.12em] text-gold uppercase">
                  {overline}
                </p>
              </StrapiEntryField>
            ) : null}

            {title ? (
              <StrapiEntryField field="title">
                <h2 className="mt-2.5 text-[clamp(26px,3.5vw,42px)] leading-tight text-dark">
                  {title}
                </h2>
              </StrapiEntryField>
            ) : null}

            {description ? (
              <StrapiEntryField field="description">
                <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-muted">
                  {description}
                </p>
              </StrapiEntryField>
            ) : null}
          </div>

          {projectItems.length > 0 ? (
            <div className="mt-12 grid gap-[18px] sm:grid-cols-2 lg:grid-cols-3">
              {projectItems.map((project) =>
                project ? (
                  <ProjectCard key={project.documentId} data={project} />
                ) : null,
              )}

              <AddStrapiEntry field="projects" />
            </div>
          ) : null}

          {viewAllProjects ? (
            <div className="mt-9 flex justify-center">
              <StrapiEntryField field="viewAllProjects">
                <Button data={viewAllProjects} />
              </StrapiEntryField>
            </div>
          ) : null}
        </div>
      </section>
    </StrapiEntry>
  );
}
