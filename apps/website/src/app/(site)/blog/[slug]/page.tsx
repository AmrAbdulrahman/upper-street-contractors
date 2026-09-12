import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ZeroCmsEntryProvider, ZeroCmsSectionList } from "@usc/zero-cms-widget";
import { BlogPostActions, BlogPostHeader } from "@/components/sections/blog-post-header";
import { PageSection, type PageSectionData } from "@/components/sections/page-section";
import {
  BlogPostingJsonLd,
  BreadcrumbJsonLd,
  NOT_FOUND_METADATA,
  resolveSocialImageUrl,
  resolveSocialImages,
} from "@/components/metadata";
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
  // An unknown slug gets the Not Found head rather than a generic one (a
  // soft-404 signal). The component below still throws; see
  // NOT_FOUND_METADATA. Same rule as projects/[id].
  if (!post) return NOT_FOUND_METADATA;

  const siteName = siteMetaConfig?.siteName ?? "Upper Street Contractors";
  // Derived, never picked: a post's own title and Excerpt ARE its metadata, so
  // there is no `meta` relation to hand-select (and no way for the two to
  // disagree). The Excerpt is already plain text for exactly this reason.
  const title = post.title ?? "Blog post";
  const description = post.excerpt ?? undefined;
  const absoluteTitle = `${title} | ${siteName}`;
  const heroUrl = resolveMediaUrl(post.hero?.url);
  // The post's own hero when it has one, the site default when it does not —
  // a post with no picture still gets a card rather than a bare link.
  const { images, twitterImages, card } = resolveSocialImages(
    siteMetaConfig,
    heroUrl,
  );

  return {
    title: { absolute: absoluteTitle },
    description,
    alternates: { canonical: `/blog/${slug}` },
    ...(post.author ? { authors: [{ name: post.author }] } : {}),
    openGraph: {
      type: "article",
      locale: "en_GB",
      siteName,
      title: absoluteTitle,
      description,
      url: `/blog/${slug}`,
      ...(post.publishedAt ? { publishedTime: post.publishedAt } : {}),
      images,
    },
    twitter: {
      card,
      title: absoluteTitle,
      description,
      images: twitterImages,
    },
  };
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { slug } = await params;
  // `getSiteMetaConfig` is React-cached, so this is the same read the chrome
  // and `generateMetadata` already made, not a third CMS call.
  const [siteMetaConfig, data] = await Promise.all([
    getSiteMetaConfig(),
    query(GetBlogPostDocument, { slug }),
  ]);
  const post = data?.blogPosts?.at(0);

  if (!post) notFound();

  const sections = post.sections ?? [];

  return (
    <article>
      <BlogPostingJsonLd
        title={post.title}
        description={post.excerpt}
        slug={slug}
        author={post.author}
        publishedAt={post.publishedAt}
        image={resolveSocialImageUrl(siteMetaConfig, resolveMediaUrl(post.hero?.url))}
        config={siteMetaConfig}
      />
      <BreadcrumbJsonLd
        config={siteMetaConfig}
        trail={[
          { name: "Blog", path: "/blog" },
          { name: post.title ?? "Blog post" },
        ]}
      />
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
