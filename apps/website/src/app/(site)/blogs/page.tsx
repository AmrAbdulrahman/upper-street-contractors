import { cache } from "react";
import type { Metadata } from "next";
import { BlogIndexView } from "@/components/sections/blog-index";
import { PageSections } from "@/components/sections/page-sections";
import { pageMetaToMetadata } from "@/components/metadata";
import { getSiteMetaConfig } from "@/components/site-meta-config";
import { GetBlogPostsDocument, GetPageDocument } from "@/generated/graphql";
import { query } from "@/lib/cms/query";

const PAGE_KEY = "blogs";
const PAGE_PATH = "/blogs";

const getPage = cache(() => query(GetPageDocument, { key: PAGE_KEY }));

export async function generateMetadata(): Promise<Metadata> {
  try {
    const [siteMetaConfig, data] = await Promise.all([getSiteMetaConfig(), getPage()]);
    return pageMetaToMetadata(data?.pages?.at(0)?.meta, {
      path: PAGE_PATH,
      siteName: siteMetaConfig?.siteName ?? undefined,
    });
  } catch {
    const siteMetaConfig = await getSiteMetaConfig();
    return pageMetaToMetadata(null, {
      path: PAGE_PATH,
      siteName: siteMetaConfig?.siteName ?? undefined,
    });
  }
}

export default async function BlogsPage() {
  const [pageData, postsData] = await Promise.all([
    getPage(),
    query(GetBlogPostsDocument),
  ]);

  const posts =
    postsData?.blogPosts?.filter((item): item is NonNullable<typeof item> =>
      Boolean(item),
    ) ?? [];

  return (
    <>
      <PageSections page={pageData.pages[0]} />
      <BlogIndexView posts={posts} />
    </>
  );
}
