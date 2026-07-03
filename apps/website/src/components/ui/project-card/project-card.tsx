"use client";

import { ZeroCmsEntry, ZeroCmsEntryField, ZeroCmsList } from "@usc/zero-cms-widget";
import { Badge, badgePropsFromStrapi } from "@/components/ui/badge";
import { ProjectCardFragment } from "@/generated/graphql";
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
  const {
    title,
    description,
    projectBanner,
    projectCategory,
    projectBadges,
    id,
  } = data;
  const badges = projectBadges?.filter(Boolean) ?? [];
  const href = `/projects/${id}`;

  return (
    <ZeroCmsEntry entry={data}>
      <article className={cardClasses}>
        <Link href={href} className="block">
          <ZeroCmsEntryField field="projectBanner">
            <ProjectBanner banner={projectBanner} category={projectCategory} />
          </ZeroCmsEntryField>
        </Link>

        <div className="p-[18px]">
          <ZeroCmsList
            className="relative z-10 mb-2.5 flex flex-wrap gap-1.5"
            field="projectBadges"
            items={badges}
          >
            {badges.map((badge) => {
              const badgeProps = badgePropsFromStrapi(badge, {
                className: "border border-border bg-surface text-subtle",
              });

              if (!badgeProps) {
                return null;
              }

              return (
                <ZeroCmsEntry key={badge.id} entry={badge}>
                  <ZeroCmsEntryField field="text">
                    <Badge {...badgeProps} />
                  </ZeroCmsEntryField>
                </ZeroCmsEntry>
              );
            })}
          </ZeroCmsList>

          <Link href={href} className="block">
            {title ? (
              <ZeroCmsEntryField field="title">
                <h3 className={titleClasses}>{title}</h3>
              </ZeroCmsEntryField>
            ) : null}

            {description ? (
              <ZeroCmsEntryField field="description">
                <p className="text-[13px] leading-[1.55] text-muted">
                  {description}
                </p>
              </ZeroCmsEntryField>
            ) : null}
          </Link>
        </div>
      </article>
    </ZeroCmsEntry>
  );
}
