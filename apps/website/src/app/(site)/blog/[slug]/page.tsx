import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ZeroCmsEntryProvider, ZeroCmsSectionList } from "@usc/zero-cms-widget";
import { BlogPostActions, BlogPostHeader } from "@/components/sections/blog-post-header";
import { PageSection, type PageSectionData } from "@/components/sections/page-section";
import { getSiteMetaConfig } from "@/components/site-meta-config";
import { GetBlogPostDocument, GetBlogSlugsDocument } from "@/generated/graphql";
import { resolveMediaUrl } from "@/helpers/media-url";
import { query } from "@/lib/cms/query";

type BlogPostPageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateStaticParams() {
  const data = await query(GetBlogSlugsDocument);
  // De-duplicated: zero-cms has no unique constraint on `slug`, and two params
  // with the same value would make Next build the same route twice.
  const slugs = new Set(
    (data?.blogPosts ?? [])
      .map((post) => post?.slug?.trim())
      .filter((slug): slug is string => Boolean(slug)),
  );
  return [...slugs].map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: BlogPostPageProps): Promise<Metadata> {
  const { slug } = await params;
  const [siteMetaConfig, data] = await Promise.all([
    getSiteMetaConfig(),
    query(GetBlogPostDocument, { slug }),
  ]);

  const post = data?.blogPosts?.at(0);
  // No fallback title: an unknown slug must render as a 404, not leak a generic
  // title onto the not-found page (a soft-404 signal). Same rule as
  // projects/[id].
  if (!post) notFound();

  const siteName = siteMetaConfig?.siteName ?? "Upper Street Contractors";
  // Derived, never picked: a post's own title and Excerpt ARE its metadata, so
  // there is no `meta` relation to hand-select (and no way for the two to
  // disagree). The Excerpt is already plain text for exactly this reason.
  const title = post.title ?? "Blog post";
  const description = post.excerpt ?? undefined;
  const absoluteTitle = `${title} | ${siteName}`;
  const heroUrl = resolveMediaUrl(post.hero?.url);

  return {
    title: { absolute: absoluteTitle },
    description,
    alternates: { canonical: `/blog/${slug}` },
    ...(post.author ? { authors: [{ name: post.author }] } : {}),
    openGraph: {
      title: absoluteTitle,
      description,
      url: `/blog/${slug}`,
      type: "article",
      ...(post.publishedAt ? { publishedTime: post.publishedAt } : {}),
      ...(heroUrl ? { images: [heroUrl] } : {}),
    },
    twitter: {
      title: absoluteTitle,
      description,
      card: heroUrl ? "summary_large_image" : "summary",
    },
  };
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { slug } = await params;
  const data = await query(GetBlogPostDocument, { slug });
  const post = data?.blogPosts?.at(0);

  if (!post) notFound();

  const sections = post.sections ?? [];

  return (
    <article>
      {/* Provider, not <ZeroCmsEntry>: the Section builder needs the post's id
          and type in context, but an outline + pencil around the entire page
          would swallow every section's own affordance. */}
      <ZeroCmsEntryProvider entry={post}>
        {/* Inside the provider so it resolves to THIS post; renders nothing
            unless edit mode is on. */}
        <div className="mx-auto max-w-container px-6 pt-6 empty:hidden">
          <BlogPostActions title={post.title} />
        </div>
        <BlogPostHeader post={post} />
        <ZeroCmsSectionList field="sections" items={sections}>
          {sections.map((section, i) => (
            <PageSection key={i} section={section as PageSectionData} />
          ))}
        </ZeroCmsSectionList>
      </ZeroCmsEntryProvider>
    </article>
  );
}
