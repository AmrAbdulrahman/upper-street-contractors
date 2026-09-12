"use client";

import { ZeroCmsEntry, ZeroCmsEntryField } from "@usc/zero-cms-widget";
import { Badge } from "@/components/ui/badge";
import { ProjectCardFragment } from "@/generated/graphql";
import { getProjectMetaChips } from "@/helpers/project-meta";
import Link from "next/link";
import { ProjectBanner } from "./project-banner";

type ProjectCardProps = {
  data: ProjectCardFragment;
  /** Just created by this editor — see `useCardFlash`. */
  flash?: boolean;
};

// `card-lift` is the site-wide hover (see globals.css) — every card gets the
// same lift and shadow rather than each one inventing its own.
const cardClasses =
  "card-lift group overflow-hidden rounded-lg border border-border bg-white";

const titleClasses =
  "mb-1.5 font-sans text-[15px] font-semibold leading-snug text-dark";

export function ProjectCard({ data, flash = false }: ProjectCardProps) {
  const { id, slug, title, summary, category, hero } = data;
  const chips = getProjectMetaChips(data);
  // The Slug is the URL. A Project created before the field existed has none
  // and still answers on its uuid, which the route resolves either way.
  const href = `/projects/${slug?.trim() || id}`;

  return (
    <ZeroCmsEntry entry={data}>
      {/* The flash class goes on the existing <article>, never a wrapper:
          <ZeroCmsEntry> clones a lone host element rather than wrapping it, and
          an extra div here would stop this being a direct grid item. */}
      <article className={flash ? `${cardClasses} card-flash` : cardClasses}>
        <Link href={href} className="block">
          <ZeroCmsEntryField field="hero">
            <ProjectBanner banner={hero} category={category} title={title} />
          </ZeroCmsEntryField>
        </Link>

        <div className="p-[18px]">
          {chips.length > 0 ? (
            <ul
              className="relative z-10 mb-2.5 flex flex-wrap gap-1.5"
              aria-label="Project details"
            >
              {chips.map((chip) => (
                <li key={chip.key}>
                  <Badge
                    variant="light"
                    radius={8}
                    className="border border-border bg-surface text-muted"
                  >
                    {chip.text}
                  </Badge>
                </li>
              ))}
            </ul>
          ) : null}

          <Link href={href} className="block">
            {title ? (
              <ZeroCmsEntryField field="title">
                <h3 className={titleClasses}>{title}</h3>
              </ZeroCmsEntryField>
            ) : null}

            {summary ? (
              <ZeroCmsEntryField field="summary">
                <p className="text-[13px] leading-[1.55] text-muted">{summary}</p>
              </ZeroCmsEntryField>
            ) : null}
          </Link>
        </div>
      </article>
    </ZeroCmsEntry>
  );
}
