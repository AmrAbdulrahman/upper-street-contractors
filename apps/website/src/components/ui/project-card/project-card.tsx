"use client";

import { ZeroCmsEntry, ZeroCmsEntryField } from "@usc/zero-cms-widget";
import { Badge } from "@/components/ui/badge";
import { ProjectCardFragment } from "@/generated/graphql";
import { getProjectMetaChips } from "@/helpers/project-meta";
import Link from "next/link";
import { ProjectBanner } from "./project-banner";

type ProjectCardProps = {
  data: ProjectCardFragment;
};

const cardClasses =
  "group overflow-hidden rounded-lg border border-border bg-white transition-all duration-250 ease-out hover:-translate-y-[3px] hover:shadow-lg";

const titleClasses =
  "mb-1.5 font-sans text-[15px] font-semibold leading-snug text-dark";

export function ProjectCard({ data }: ProjectCardProps) {
  const { id, title, summary, category, hero } = data;
  const chips = getProjectMetaChips(data);
  const href = `/projects/${id}`;

  return (
    <ZeroCmsEntry entry={data}>
      <article className={cardClasses}>
        <Link href={href} className="block">
          <ZeroCmsEntryField field="hero">
            <ProjectBanner banner={hero} category={category} />
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
