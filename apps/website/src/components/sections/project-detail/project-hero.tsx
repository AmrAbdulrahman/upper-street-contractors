import { ZeroCmsEntry, ZeroCmsEntryField } from "@usc/zero-cms-widget";
import type { ProjectDetailFragment } from "@/generated/graphql";
import { getDuration } from "@/helpers/project-meta";
import { resolveStrapiMediaUrl } from "@/helpers/strapi-media-url";
import Image from "next/image";
import Link from "next/link";

const glassChip =
  "inline-flex items-center rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-white/80";
const goldChip =
  "inline-flex items-center rounded-full border border-gold/35 bg-gold/20 px-3 py-1 text-xs font-semibold text-gold";

type GalleryImage = NonNullable<
  NonNullable<ProjectDetailFragment["projectImages"]>[number]
>;

function completedYear(endDate?: string | null): number | null {
  if (!endDate) return null;
  const t = Date.parse(endDate);
  return Number.isNaN(t) ? null : new Date(t).getUTCFullYear();
}

function GalleryFigure({
  img,
  className,
  sizes,
  priority,
}: {
  img: GalleryImage;
  className?: string;
  sizes: string;
  priority?: boolean;
}) {
  const url = resolveStrapiMediaUrl(img.image?.url);
  return (
    <figure
      className={`relative overflow-hidden border border-white/10 bg-white/5 ${className ?? ""}`}
    >
      {url ? (
        <Image
          src={url}
          alt={img.image?.alt ?? img.caption ?? "Project photo"}
          fill
          className="object-cover"
          sizes={sizes}
          priority={priority}
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-[#0a1c2e] to-[#031021]" />
      )}
      {img.caption ? (
        <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/65 to-transparent px-3 py-2 text-xs font-medium text-white/90">
          {img.caption}
        </figcaption>
      ) : null}
    </figure>
  );
}

export function ProjectHero({ project }: { project: ProjectDetailFragment }) {
  const { title, location, projectValue, subCategory } = project;
  const intro = (project.description ?? project.summary ?? "")
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  const duration = getDuration(project.beginDate, project.endDate);
  const year = completedYear(project.endDate);
  const images = (project.projectImages ?? []).filter(
    (i): i is GalleryImage => Boolean(i),
  );
  const [main, ...rest] = images;
  const sides = rest.slice(0, 2);

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

        {main ? (
          <div className="mt-10 grid gap-3 overflow-hidden rounded-t-lg md:h-[460px] md:grid-cols-3">
            <div className={sides.length ? "md:col-span-2" : "md:col-span-3"}>
              <ZeroCmsEntry entry={main}>
                <GalleryFigure
                  img={main}
                  className="h-64 md:h-full"
                  sizes="(max-width: 768px) 100vw, 66vw"
                  priority
                />
              </ZeroCmsEntry>
            </div>
            {sides.length ? (
              <div className="grid gap-3 md:grid-rows-2">
                {sides.map((img) => (
                  <ZeroCmsEntry key={img.id} entry={img}>
                    <GalleryFigure
                      img={img}
                      className="h-40 md:h-full"
                      sizes="(max-width: 768px) 100vw, 33vw"
                    />
                  </ZeroCmsEntry>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
