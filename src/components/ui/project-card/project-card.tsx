"use client";

import { ContentfulEntry, ContentfulEntryField } from "@/components/contentful";
import { Badge, badgePropsFromContentful } from "@/components/ui/badge";
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
    projectBadgesCollection,
    sys,
  } = data;
  const badges = projectBadgesCollection?.items?.filter(Boolean) ?? [];
  const href = `/projects/${sys.id}`;

  return (
    <ContentfulEntry entry={data}>
      <article className={cardClasses}>
        <Link href={href} className="block">
          <ContentfulEntryField field="projectBanner">
            <ProjectBanner banner={projectBanner} category={projectCategory} />
          </ContentfulEntryField>
        </Link>

        <div className="p-[18px]">
          {badges.length > 0 ? (
            <div className="relative z-10 mb-2.5 flex flex-wrap gap-1.5">
              {badges.map((badge) => {
                const badgeProps = badgePropsFromContentful(badge, {
                  className: "border border-border bg-surface text-subtle",
                });

                if (!badgeProps) {
                  return null;
                }

                return (
                  <ContentfulEntry key={badge._id} entry={badge}>
                    <ContentfulEntryField field="text">
                      <Badge {...badgeProps} />
                    </ContentfulEntryField>
                  </ContentfulEntry>
                );
              })}
            </div>
          ) : null}

          <Link href={href} className="block">
            {title ? (
              <ContentfulEntryField field="title">
                <h3 className={titleClasses}>{title}</h3>
              </ContentfulEntryField>
            ) : null}

            {description ? (
              <ContentfulEntryField field="description">
                <p className="text-[13px] leading-[1.55] text-muted">
                  {description}
                </p>
              </ContentfulEntryField>
            ) : null}
          </Link>
        </div>
      </article>
    </ContentfulEntry>
  );
}
