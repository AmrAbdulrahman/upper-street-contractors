import { ZeroCmsEntryField } from "@usc/zero-cms-widget";
import type { ProjectDetailFragment } from "@/generated/graphql";
import { getDuration } from "@/helpers/project-meta";
import { resolveMediaUrl } from "@/helpers/media-url";
import Image from "next/image";
import Link from "next/link";

const glassChip =
  "inline-flex items-center rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-white/80";
// gold-mid, not gold: #906d37 on the gold/20-over-dark chip bg is 3.34:1 —
// below WCAG AA (4.5) for 12px text; #b8925a clears it at 5.5:1.
const goldChip =
  "inline-flex items-center rounded-full border border-gold/35 bg-gold/20 px-3 py-1 text-xs font-semibold text-gold-mid";

function completedYear(endDate?: string | null): number | null {
  if (!endDate) return null;
  const t = Date.parse(endDate);
  return Number.isNaN(t) ? null : new Date(t).getUTCFullYear();
}

/**
 * The banner at the top of a Project: breadcrumb, title, fact chips, intro and
 * the hero photo.
 *
 * Rendered from the Project's OWN fields rather than from a section, the same
 * way `BlogPostHeader` is: the index card and this header must agree, and a
 * title living in two places guarantees they eventually won't. It also can't be
 * reordered away — a Project always has a header.
 *
 * The photo is the Project's `hero`, singular. It used to be a three-up collage
 * built from the first three `projectImages`, which no longer exist on the
 * Project — a Project's photos are a Gallery section now (ADR 0022), where an
 * editor can place, caption and reorder them like any other content.
 */
export function ProjectHero({ project }: { project: ProjectDetailFragment }) {
  const { title, location, projectValue, subCategory } = project;
  const intro = (project.description ?? project.summary ?? "")
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  const duration = getDuration(project.beginDate, project.endDate);
  const year = completedYear(project.endDate);
  const heroUrl = resolveMediaUrl(project.hero?.url);

  return (
    <section className="bg-dark text-white">
      <div className="mx-auto max-w-container px-6 pt-[72px]">
        <nav aria-label="Breadcrumb">
          <ol className="flex flex-wrap items-center gap-2 text-[13px] text-subtle">
            <li>
              <Link href="/" className="transition-colors hover:text-white">
                Home
              </Link>
            </li>
            <li aria-hidden>/</li>
            <li>
              <Link
                href="/projects"
                className="transition-colors hover:text-white"
              >
                Projects
              </Link>
            </li>
            <li aria-hidden>/</li>
            <li aria-current="page" className="text-white/80">
              {title}
            </li>
          </ol>
        </nav>

        <p className="mt-6 text-[11px] font-bold tracking-[0.14em] text-gold-mid uppercase">
          Case study
        </p>

        <ZeroCmsEntryField field="title">
          <h1 className="mt-3 font-serif text-[clamp(32px,5vw,56px)] leading-[1.08] text-white">
            {location ? (
              <>
                <span className="block">{title},</span>
                <span className="block text-gold">{location}</span>
              </>
            ) : (
              title
            )}
          </h1>
        </ZeroCmsEntryField>

        <ul className="mt-6 flex flex-wrap gap-2" aria-label="Project facts">
          {location ? (
            <ZeroCmsEntryField field="location">
              <li className={glassChip}>📍 {location}</li>
            </ZeroCmsEntryField>
          ) : null}
          {duration ? (
            <ZeroCmsEntryField field="beginDate">
              <li className={glassChip}>⏱ {duration}</li>
            </ZeroCmsEntryField>
          ) : null}
          {projectValue ? (
            <ZeroCmsEntryField field="projectValue">
              <li className={goldChip}>{projectValue}</li>
            </ZeroCmsEntryField>
          ) : null}
          {subCategory ? (
            <ZeroCmsEntryField field="subCategory">
              <li className={glassChip}>🏠 {subCategory}</li>
            </ZeroCmsEntryField>
          ) : null}
          {year ? (
            <ZeroCmsEntryField field="endDate">
              <li className={glassChip}>✓ Completed {year}</li>
            </ZeroCmsEntryField>
          ) : null}
        </ul>

        {intro.length ? (
          <ZeroCmsEntryField field="description">
            <div className="mt-6 max-w-2xl space-y-3 text-lg leading-[1.7] text-white/70">
              {intro.map((paragraph, i) => (
                <p key={i}>{paragraph}</p>
              ))}
            </div>
          </ZeroCmsEntryField>
        ) : null}

        {heroUrl ? (
          <ZeroCmsEntryField field="hero">
            <div className="relative mt-10 h-64 overflow-hidden rounded-t-lg border border-white/10 bg-white/5 md:h-[460px]">
              <Image
                src={heroUrl}
                alt={project.hero?.alt ?? title ?? "Project photo"}
                fill
                className="img-zoom object-cover"
                sizes="(max-width: 1200px) 100vw, 1200px"
                priority
              />
            </div>
          </ZeroCmsEntryField>
        ) : null}
      </div>
    </section>
  );
}
