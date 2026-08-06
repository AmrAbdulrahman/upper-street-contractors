import Link from "next/link";
import { ZeroCmsEntry, ZeroCmsEntryField } from "@usc/zero-cms-widget";
import { Badge } from "@/components/ui/badge";
import { CmsImage } from "@/components/ui/cms-image";
import { formatPublishedDate } from "@/helpers/blog-post";
import type { BlogPostCardFragment } from "@/generated/graphql";

type BlogCardProps = {
  data: BlogPostCardFragment;
};

/**
 * One post on the Blog index. Mirrors the Project card's proportions and hover
 * so the two grids read as the same site, but carries a date rather than meta
 * chips — a post's useful facet is when it was written.
 */
export function BlogCard({ data }: BlogCardProps) {
  const { slug, title, excerpt, category, publishedAt, hero } = data;
  // A post with no slug has no URL to link to; still rendered so an editor can
  // see and fix it in inspect mode rather than having it silently vanish.
  const href = slug ? `/blog/${slug}` : undefined;
  const published = formatPublishedDate(publishedAt);

  const body = (
    <>
      {title ? (
        <ZeroCmsEntryField field="title">
          <h3 className="mb-1.5 font-sans text-[15px] leading-snug font-semibold text-dark">
            {title}
          </h3>
        </ZeroCmsEntryField>
      ) : null}

      {excerpt ? (
        <ZeroCmsEntryField field="excerpt">
          {/* Clamped so a long Excerpt can't make one card taller than the rest
              of its row. The post's own page shows it in full. */}
          <p className="line-clamp-3 text-[13px] leading-[1.55] text-muted">
            {excerpt}
          </p>
        </ZeroCmsEntryField>
      ) : null}
    </>
  );

  return (
    <ZeroCmsEntry entry={data}>
      <article className="group overflow-hidden rounded-lg border border-border bg-white transition-all duration-250 ease-out hover:-translate-y-[3px] hover:shadow-lg">
        <div className="relative">
          {href ? (
            <Link href={href} className="block" tabIndex={-1} aria-hidden>
              <ZeroCmsEntryField field="hero">
                <CmsImage
                  data={hero}
                  fallbackAlt={title ?? "Blog post"}
                  placeholderLabel="Post image placeholder"
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 360px"
                  className="h-[200px] w-full object-cover"
                />
              </ZeroCmsEntryField>
            </Link>
          ) : (
            <ZeroCmsEntryField field="hero">
              <CmsImage
                data={hero}
                fallbackAlt={title ?? "Blog post"}
                placeholderLabel="Post image placeholder"
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 360px"
                className="h-[200px] w-full object-cover"
              />
            </ZeroCmsEntryField>
          )}

          {category ? (
            <div className="absolute top-3 left-3">
              <Badge variant="dark" radius={6} className="bg-gold-deep text-white uppercase">
                {category}
              </Badge>
            </div>
          ) : null}
        </div>

        <div className="p-[18px]">
          {published ? (
            <ZeroCmsEntryField field="publishedAt">
              <p className="mb-2 text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">
                <time dateTime={publishedAt ?? undefined}>{published}</time>
              </p>
            </ZeroCmsEntryField>
          ) : null}

          {href ? (
            <Link href={href} className="block">
              {body}
            </Link>
          ) : (
            body
          )}
        </div>
      </article>
    </ZeroCmsEntry>
  );
}
