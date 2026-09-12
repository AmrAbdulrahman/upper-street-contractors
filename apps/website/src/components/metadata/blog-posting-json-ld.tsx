import { JsonLd } from "./json-ld";
import { resolveSiteOrigin } from "./site-origin";

type BlogPostingJsonLdProps = {
  title?: string | null;
  /** The Excerpt — a post's only description, by design. */
  description?: string | null;
  slug: string;
  /** Display name, stored as text (ADR 0016) — not a link to an account. */
  author?: string | null;
  publishedAt?: string | null;
  image?: string | null;
  config?: { siteUrl?: string | null; siteName?: string | null } | null;
};

/**
 * The article node behind a blog post's rich result.
 *
 * Every field is the post's own — the same title, Excerpt, hero and Author the
 * page renders — so the markup and the structured data are two views of one
 * record rather than two things to keep in step.
 */
export function BlogPostingJsonLd({
  title,
  description,
  slug,
  author,
  publishedAt,
  image,
  config,
}: BlogPostingJsonLdProps) {
  const origin = resolveSiteOrigin(config);
  const url = `${origin}/blog/${slug}`;
  const publisher = config?.siteName ?? "Upper Street Contractors";

  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "BlogPosting",
        headline: title ?? undefined,
        description: description ?? undefined,
        image: image ?? undefined,
        datePublished: publishedAt ?? undefined,
        author: author ? { "@type": "Person", name: author } : undefined,
        publisher: { "@type": "Organization", name: publisher, url: origin },
        mainEntityOfPage: { "@type": "WebPage", "@id": url },
        url,
      }}
    />
  );
}
