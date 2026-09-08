import Link from "next/link";
import { ZeroCmsEntryField } from "@usc/zero-cms-widget";
import { Badge } from "@/components/ui/badge";
import { CmsImage } from "@/components/ui/cms-image";
import { formatPublishedDate } from "@/helpers/blog-post";
import type { GetBlogPostQuery } from "@/generated/graphql";

type BlogPost = NonNullable<GetBlogPostQuery["blogPosts"][number]>;

/**
 * The banner at the top of a post: breadcrumb (ending in this post's own title),
 * title, category, excerpt, date, author, hero image.
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
  // A plain string now: the display name of the CMS user chosen as the author
  // (ADR 0016), rather than a related `author` entry with its own avatar.
  const authorName = author?.trim() ?? "";
  const heading = title ?? "Untitled post";

  return (
    <header className="bg-surface">
      <div className="mx-auto max-w-container px-6 pt-10 pb-[56px]">
        {/* The post's own title is the last crumb — plain text with
            aria-current, since a link to the page you are on is noise. Truncated
            rather than wrapped so a long headline can't push the trail onto a
            second line. */}
        <nav aria-label="Breadcrumb" className="mb-6 text-[13px] text-muted">
          <ol className="flex flex-wrap items-center gap-x-1">
            <li>
              <Link href="/" className="transition-colors hover:text-dark">
                Home
              </Link>
            </li>
            <li aria-hidden>/</li>
            <li>
              <Link href="/blog" className="transition-colors hover:text-dark">
                Blog
              </Link>
            </li>
            <li aria-hidden>/</li>
            <li className="min-w-0">
              <span
                aria-current="page"
                title={heading}
                className="block max-w-[42ch] truncate text-dark"
              >
                {heading}
              </span>
            </li>
          </ol>
        </nav>

        <ZeroCmsEntryField field="title">
          <h1 className="max-w-[28ch] font-serif text-3xl leading-tight text-dark sm:text-4xl">
            {heading}
          </h1>
        </ZeroCmsEntryField>

        {/* Under the title, not above it: the headline is what a reader came for,
            and the category is how they place it afterwards. */}
        {category ? (
          <ZeroCmsEntryField field="category">
            <p className="mt-4">
              <Badge variant="dark" radius={6} className="bg-gold-deep text-white uppercase">
                {category}
              </Badge>
            </p>
          </ZeroCmsEntryField>
        ) : null}

        {excerpt ? (
          <ZeroCmsEntryField field="excerpt">
            <p className="mt-4 max-w-[62ch] text-base leading-relaxed text-muted">
              {excerpt}
            </p>
          </ZeroCmsEntryField>
        ) : null}

        {published || authorName ? (
          <p className="mt-6 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-muted">
            {authorName ? (
              <ZeroCmsEntryField field="author">
                <span>By {authorName}</span>
              </ZeroCmsEntryField>
            ) : null}
            {authorName && published ? <span aria-hidden>·</span> : null}
            {published ? (
              <time dateTime={publishedAt ?? undefined}>{published}</time>
            ) : null}
          </p>
        ) : null}

        {hero?.url ? (
          <ZeroCmsEntryField field="hero">
            <div className="mt-8 overflow-hidden rounded-2xl">
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
