import Link from "next/link";
import { ZeroCmsEntry, ZeroCmsEntryField } from "@usc/zero-cms-widget";
import { Badge } from "@/components/ui/badge";
import { CmsImage } from "@/components/ui/cms-image";
import { formatPublishedDate } from "@/helpers/blog-post";
import type { BlogPostCardFragment } from "@/generated/graphql";

type BlogCardProps = {
  data: BlogPostCardFragment;
  /** Just created by this editor — see `useCardFlash`. */
  flash?: boolean;
};

/**
 * One post on the Blog index. Mirrors the Project card's proportions and hover
 * so the two grids read as the same site, but carries a date rather than meta
 * chips — a post's useful facet is when it was written.
 */
export function BlogCard({ data, flash = false }: BlogCardProps) {
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
      {/* The flash class goes on the existing <article>, never a wrapper:
          <ZeroCmsEntry> clones a lone host element rather than wrapping it, and
          an extra div here would stop this being a direct grid item. */}
      <article
        className={`card-lift group overflow-hidden rounded-lg border border-border bg-white${
          flash ? " card-flash" : ""
        }`}
      >
        <div className="relative">
          {/* The image is clipped by its own wrapper, not just by the card: the
              card clips too, but only at its outer edge — a zooming photo would
              still grow down over the title beneath it. The Category badge sits
              outside that wrapper on purpose, so it stays put while the photo
              moves under it. */}
          {href ? (
            <Link
              href={href}
              className="block overflow-hidden"
              tabIndex={-1}
              aria-hidden
            >
              <ZeroCmsEntryField field="hero">
                <CmsImage
                  data={hero}
                  fallbackAlt={title ?? "Blog post"}
                  placeholderLabel="Post image placeholder"
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 360px"
                  className="card-zoom h-[200px] w-full object-cover"
                />
              </ZeroCmsEntryField>
            </Link>
          ) : (
            <div className="overflow-hidden">
              <ZeroCmsEntryField field="hero">
                <CmsImage
                  data={hero}
                  fallbackAlt={title ?? "Blog post"}
                  placeholderLabel="Post image placeholder"
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 360px"
                  className="card-zoom h-[200px] w-full object-cover"
                />
              </ZeroCmsEntryField>
            </div>
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
