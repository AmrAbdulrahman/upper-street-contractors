import type { BlogPostCardFragment } from "@/generated/graphql";

/**
 * Blog Post helpers shared by the index, the card and the post header.
 *
 * `publishedAt` is a zero-cms `date` — an ISO `YYYY-MM-DD` string, not a
 * timestamp — so everything here is string work. Formatting goes through a fixed
 * `en-GB` locale rather than the runtime default: this renders on the server
 * during SSG and again on the client, and a locale-dependent format would be a
 * hydration mismatch.
 */
const DATE_FORMAT = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

export function formatPublishedDate(
  publishedAt: string | null | undefined,
): string | null {
  if (!publishedAt?.trim()) return null;
  const date = new Date(`${publishedAt}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  return DATE_FORMAT.format(date);
}

/** Newest first; posts with no date sort last rather than jumping to the top. */
export function byNewestFirst(
  a: BlogPostCardFragment,
  b: BlogPostCardFragment,
): number {
  const left = a.publishedAt ?? "";
  const right = b.publishedAt ?? "";
  if (left === right) return (a.title ?? "").localeCompare(b.title ?? "");
  if (!left) return 1;
  if (!right) return -1;
  return right.localeCompare(left);
}

/** Every distinct category present, in first-seen order (same shape as the Projects filter). */
export function deriveBlogCategories(posts: BlogPostCardFragment[]): string[] {
  const seen = new Set<string>();
  const categories: string[] = [];
  for (const post of posts) {
    const category = post.category?.trim();
    if (!category || seen.has(category)) continue;
    seen.add(category);
    categories.push(category);
  }
  return categories;
}

/**
 * Free-text match over the fields a reader would actually search by. Runs over
 * the WHOLE set, never just the visible page — a search that only looked at
 * page 2 of a pager would be worse than no search at all.
 */
export function matchesBlogQuery(post: BlogPostCardFragment, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [post.title, post.excerpt, post.category].some((value) =>
    value?.toLowerCase().includes(q),
  );
}
