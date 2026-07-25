import Link from "next/link";
import { ZeroCmsEntryField } from "@usc/zero-cms-widget";
import { Badge } from "@/components/ui/badge";
import { CmsImage } from "@/components/ui/cms-image";
import { formatPublishedDate } from "@/helpers/blog-post";
import type { GetBlogPostQuery } from "@/generated/graphql";

type BlogPost = NonNullable<GetBlogPostQuery["blogPosts"][number]>;

/**
 * The banner at the top of a post: breadcrumb, category, title, date, author,
 * hero image.
 *
 * Rendered from the Blog Post's OWN fields rather than from a Hero section, for
 * the same reason `ProjectHero` reads Project fields: the index card and this
 * header must agree, and a title living in two places guarantees they eventually
 * won't. It sits outside the Section builder, so it can't be reordered away or
 * deleted — a post always has a header.
 *
 * Must be rendered inside the post's <ZeroCmsEntryProvider> so the field pencils
 * resolve to the post entry.
 */
export function BlogPostHeader({ post }: { post: BlogPost }) {
  const { title, category, publishedAt, hero, author, excerpt } = post;
  const published = formatPublishedDate(publishedAt);
  const authorName = [author?.name, author?.lastname].filter(Boolean).join(" ");

  return (
    <header className="bg-surface">
      <div className="mx-auto max-w-container px-6 pt-10 pb-[56px]">
        <nav aria-label="Breadcrumb" className="mb-6 text-[13px] text-muted">
          <Link href="/" className="transition-colors hover:text-dark">
            Home
          </Link>
          <span aria-hidden> / </span>
          <Link href="/blogs" className="transition-colors hover:text-dark">
            Blogs
          </Link>
        </nav>

        {category ? (
          <ZeroCmsEntryField field="category">
            <p className="mb-4">
              <Badge variant="dark" radius={6} className="bg-gold-deep text-white uppercase">
                {category}
              </Badge>
            </p>
          </ZeroCmsEntryField>
        ) : null}

        <ZeroCmsEntryField field="title">
          <h1 className="max-w-[28ch] font-serif text-3xl leading-tight text-dark sm:text-4xl">
            {title ?? "Untitled post"}
          </h1>
        </ZeroCmsEntryField>

        {excerpt ? (
          <ZeroCmsEntryField field="excerpt">
            <p className="mt-4 max-w-[62ch] text-base leading-relaxed text-muted">
              {excerpt}
            </p>
          </ZeroCmsEntryField>
        ) : null}

        {published || authorName ? (
          <p className="mt-6 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-muted">
            {authorName ? <span>By {authorName}</span> : null}
            {authorName && published ? <span aria-hidden>·</span> : null}
            {published ? (
              <time dateTime={publishedAt ?? undefined}>{published}</time>
            ) : null}
          </p>
        ) : null}

        {hero?.url ? (
          <ZeroCmsEntryField field="hero">
            <div className="mt-8">
              <CmsImage
                data={hero}
                fallbackAlt={title ?? "Blog post"}
                placeholderLabel="Hero image placeholder"
                sizes="(max-width: 1024px) 100vw, 1120px"
                className="h-[280px] w-full rounded-2xl object-cover sm:h-[420px]"
              />
            </div>
          </ZeroCmsEntryField>
        ) : null}
      </div>
    </header>
  );
}
