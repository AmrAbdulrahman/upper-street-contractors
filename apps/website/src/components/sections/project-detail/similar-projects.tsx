import { ZeroCmsEntryField, ZeroCmsEntryProvider } from "@usc/zero-cms-widget";
import { ProjectCard } from "@/components/ui/project-card";
import type { ProjectCardFragment } from "@/generated/graphql";
import Link from "next/link";
import type { ReactElement } from "react";

type SimilarProjectsProps = {
  projects: ProjectCardFragment[];
  overline?: string;
  title?: string;
  ctaHref?: string;
  ctaLabel?: string;
  /**
   * The Project this strip belongs to, when it has one. Its presence is what
   * gives the strip a pencil: the pencil edits `similarWork`, the host's own
   * pin list, so a strip with no host has nothing to edit.
   */
  host?: { id: string } | null;
};

/**
 * Project card grid. Used two ways:
 * - Project detail "Similar work" strip (editor pins + auto ranking).
 * - Service-page Case Studies strip (Projects filtered by Category), which
 *   overrides the headings via props and passes no `host`.
 *
 * The grid is a plain `.map()`, not a Reference list: the list rendered here is
 * computed (pins first, then the closest others), so there is no stored order
 * to insert into or drag around. What CAN be edited is the pinned half, and
 * that lives on the host Project — hence the field pencil rather than a list
 * editor. Each card carries its own pencil for its own Project, as everywhere
 * else `<ProjectCard>` is used.
 */
export function SimilarProjects({
  projects,
  overline = "More projects",
  title = "Similar work we've delivered",
  ctaHref = "/projects",
  ctaLabel = "View All Projects →",
  host,
}: SimilarProjectsProps) {
  if (projects.length === 0) {
    return null;
  }

  return (
    <WithPinsPencil host={host}>
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
            className="inline-flex h-12 items-center justify-center rounded-full border border-dark bg-dark px-7 text-sm font-semibold text-white transition-colors hover:border-gold-mid hover:bg-gold-mid hover:text-dark"
          >
            {ctaLabel}
          </Link>
        </div>
      </div>
      </section>
    </WithPinsPencil>
  );
}

/**
 * Wraps the strip in the host Project's `similarWork` field, or in nothing at
 * all. The pencil goes on the whole strip because that is what the field
 * produces — the pinned Projects and the auto-filled ones are one grid, and
 * there is no per-card affordance that would mean "pin this".
 *
 * A provider plus a FIELD wrapper, never `<ZeroCmsEntry>`: the entry wrapper
 * would put a second pencil on the same `<section>`, and both would open the
 * same drawer — one focused on the field, one not.
 */
function WithPinsPencil({
  host,
  children,
}: {
  host?: { id: string } | null;
  children: ReactElement;
}) {
  if (!host) return <>{children}</>;

  return (
    <ZeroCmsEntryProvider entry={{ id: host.id, type: "project" }}>
      <ZeroCmsEntryField field="similarWork">{children}</ZeroCmsEntryField>
    </ZeroCmsEntryProvider>
  );
}
