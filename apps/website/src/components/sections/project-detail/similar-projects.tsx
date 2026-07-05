import { ProjectCard } from "@/components/ui/project-card";
import type { ProjectCardFragment } from "@/generated/graphql";
import Link from "next/link";

type SimilarProjectsProps = {
  projects: ProjectCardFragment[];
  overline?: string;
  title?: string;
  ctaHref?: string;
  ctaLabel?: string;
};

/**
 * Display-only project card grid. Used two ways:
 * - Project detail "Similar work" strip (computed pins + auto ranking).
 * - Service-page Case Studies strip (Projects filtered by Category), which
 *   overrides the headings via props.
 * The list is precomputed, so it is NOT wrapped in a references editor.
 */
export function SimilarProjects({
  projects,
  overline = "More projects",
  title = "Similar work we've delivered",
  ctaHref = "/projects",
  ctaLabel = "View All Projects →",
}: SimilarProjectsProps) {
  if (projects.length === 0) {
    return null;
  }

  return (
    <section className="bg-white">
      <div className="mx-auto max-w-container px-6 py-[88px]">
        <p className="text-center text-[11px] font-bold tracking-[0.14em] text-gold-deep uppercase">
          {overline}
        </p>
        <h2 className="mt-2 text-center font-serif text-[clamp(28px,3.2vw,40px)] leading-tight text-dark">
          {title}
        </h2>

        <div className="mt-10 grid gap-[18px] sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <ProjectCard key={project.id} data={project} />
          ))}
        </div>

        <div className="mt-10 flex justify-center">
          <Link
            href={ctaHref}
            className="inline-flex h-12 items-center justify-center rounded-full bg-dark px-7 text-sm font-semibold text-white transition-colors hover:bg-dark/90"
          >
            {ctaLabel}
          </Link>
        </div>
      </div>
    </section>
  );
}
