import { ProjectCard } from "@/components/ui/project-card";
import type { ProjectCardFragment } from "@/generated/graphql";
import Link from "next/link";

type SimilarProjectsProps = {
  projects: ProjectCardFragment[];
};

/**
 * Display-only "Similar work" section. The list is computed (editor pins + auto
 * ranking) on the detail page, so it is NOT wrapped in a references editor — the
 * editable `similarWork` pins live on the project's own Edit drawer.
 */
export function SimilarProjects({ projects }: SimilarProjectsProps) {
  if (projects.length === 0) {
    return null;
  }

  return (
    <section className="bg-white">
      <div className="mx-auto max-w-container px-6 py-[88px]">
        <p className="text-center text-[11px] font-bold tracking-[0.14em] text-gold uppercase">
          More projects
        </p>
        <h2 className="mt-2 text-center font-serif text-[clamp(28px,3.2vw,40px)] leading-tight text-dark">
          Similar work we&apos;ve delivered
        </h2>

        <div className="mt-10 grid gap-[18px] sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <ProjectCard key={project.id} data={project} />
          ))}
        </div>

        <div className="mt-10 flex justify-center">
          <Link
            href="/projects"
            className="inline-flex h-12 items-center justify-center rounded-full bg-dark px-7 text-sm font-semibold text-white transition-colors hover:bg-dark/90"
          >
            View All Projects →
          </Link>
        </div>
      </div>
    </section>
  );
}
