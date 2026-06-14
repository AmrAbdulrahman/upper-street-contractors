"use client";

import { StrapiEntry, StrapiEntryField } from "@/components/strapi";
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
    documentId,
  } = data;
  const badges = projectBadges?.filter(Boolean) ?? [];
  const href = `/projects/${documentId}`;

  return (
    <StrapiEntry entry={data}>
      <article className={cardClasses}>
        <Link href={href} className="block">
          <StrapiEntryField field="projectBanner">
            <ProjectBanner banner={projectBanner} category={projectCategory} />
          </StrapiEntryField>
        </Link>

        <div className="p-[18px]">
          {badges.length > 0 ? (
            <div className="relative z-10 mb-2.5 flex flex-wrap gap-1.5">
              {badges.map((badge) => {
                const badgeProps = badgePropsFromStrapi(badge, {
                  className: "border border-border bg-surface text-subtle",
                });

                if (!badgeProps) {
                  return null;
                }

                return (
                  <StrapiEntry key={badge.documentId} entry={badge}>
                    <StrapiEntryField field="text">
                      <Badge {...badgeProps} />
                    </StrapiEntryField>
                  </StrapiEntry>
                );
              })}
            </div>
          ) : null}

          <Link href={href} className="block">
            {title ? (
              <StrapiEntryField field="title">
                <h3 className={titleClasses}>{title}</h3>
              </StrapiEntryField>
            ) : null}

            {description ? (
              <StrapiEntryField field="description">
                <p className="text-[13px] leading-[1.55] text-muted">
                  {description}
                </p>
              </StrapiEntryField>
            ) : null}
          </Link>
        </div>
      </article>
    </StrapiEntry>
  );
}
