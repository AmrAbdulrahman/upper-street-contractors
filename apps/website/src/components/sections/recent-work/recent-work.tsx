import {
  ZeroCmsEntry,
  ZeroCmsEntryField,
  ZeroCmsList,
  ZeroCmsRelationEntry,
} from "@usc/zero-cms-widget";
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
    <ZeroCmsEntry entry={data}>
      <section className="bg-white">
        <div className="mx-auto max-w-container px-6 py-[88px]">
          <div className="mx-auto max-w-2xl text-center">
            {overline ? (
              <ZeroCmsEntryField field="overline">
                <p className="text-[11px] font-bold tracking-[0.12em] text-gold-deep uppercase">
                  {overline}
                </p>
              </ZeroCmsEntryField>
            ) : null}

            {title ? (
              <ZeroCmsEntryField field="title">
                <h2 className="mt-2.5 text-[clamp(26px,3.5vw,42px)] leading-tight text-dark">
                  {title}
                </h2>
              </ZeroCmsEntryField>
            ) : null}

            {description ? (
              <ZeroCmsEntryField field="description">
                <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-muted">
                  {description}
                </p>
              </ZeroCmsEntryField>
            ) : null}
          </div>

          <ZeroCmsList
            className="mt-12 grid gap-[18px] sm:grid-cols-2 lg:grid-cols-3"
            field="projects"
            items={projectItems}
          >
            {projectItems.map((project) =>
              project ? <ProjectCard key={project.id} data={project} /> : null,
            )}
          </ZeroCmsList>

          {viewAllProjects ? (
            <div className="mt-9 flex justify-center">
              <ZeroCmsRelationEntry entry={viewAllProjects} field="viewAllProjects">
                <Button data={viewAllProjects} />
              </ZeroCmsRelationEntry>
            </div>
          ) : null}
        </div>
      </section>
    </ZeroCmsEntry>
  );
}
