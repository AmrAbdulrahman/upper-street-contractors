"use client";

import { useMemo, useState } from "react";
import {
  useInspect,
  useSurfaceTone,
  useZeroCmsWidgetOptional,
} from "@usc/zero-cms-widget";
import { BlogCard } from "@/components/ui/blog-card";
import {
  byNewestFirst,
  deriveBlogCategories,
  matchesBlogQuery,
} from "@/helpers/blog-post";
import type { BlogPostCardFragment } from "@/generated/graphql";

const ALL_POSTS_LABEL = "All posts";
const PER_PAGE = 9;

/**
 * What "duplicate this post" means, in this content model.
 *
 * A post's `sections` ARE its content, so they are copied — a shared section
 * would let an edit to the copy rewrite the original. These Types are not part
 * of the post and are shared instead:
 *
 * - `project` / `blog-post` / `page` — each has its own URL. A Recent Work
 *   section pins Projects; copying them would mint orphan case studies that
 *   appear nowhere and duplicate the real ones in `/projects`.
 * - `button` — every CTA band on the site points at the same two Button
 *   entries, so that changing the wording once changes it everywhere. A copy
 *   would quietly opt this post out of that.
 * - `icon` — a shared glyph registry, not content.
 *
 * `slug` is cleared rather than copied: zero-cms enforces no uniqueness, so a
 * duplicated slug silently shadows the original (the route takes the first
 * match). Blank, it re-derives from the new title.
 */
const DUPLICATE_BLOG_POST = {
  shareTypes: ["project", "blog-post", "page", "button", "icon"],
  clearFields: ["slug"],
  renameField: "title",
} as const;

type BlogIndexViewProps = {
  posts: BlogPostCardFragment[];
};

/**
 * The Blog index: a text search and a category chip row over every published
 * post, then a numbered pager.
 *
 * Every post ships in this page's HTML and the filtering is client-side. That is
 * the deliberate trade: search covers the WHOLE archive rather than one page,
 * and there is a single route to revalidate on publish. Crawl discovery does not
 * depend on the pager at all — `getAllSitePaths` feeds every `/blog/<slug>`
 * into `sitemap.ts`. Revisit only if the archive grows past a few hundred posts.
 *
 * Filter chips reuse the Projects index's markup so the two indexes stay
 * visually identical.
 */
export function BlogIndexView({ posts }: BlogIndexViewProps) {
  const [query, setQuery] = useState("");
  const [selectedFilter, setSelectedFilter] = useState(ALL_POSTS_LABEL);
  const [page, setPage] = useState(1);
  // A Blog Post is queried by Type, not held in any parent's relation field, so
  // there is no "+ Add" affordance to inherit — without this an editor has to
  // leave the site for the Content admin just to start a post.
  const widget = useZeroCmsWidgetOptional();
  // `useInspect`, not `widget.inspect`: the button below is markup the server never
  // sent, and the context flag flips before deep subtrees finish hydrating.
  const inspect = useInspect();
  // This section is `bg-surface` today, but the tone is measured rather than
  // assumed — same hook the Section builder's own add affordances use, so a
  // future background change can't quietly make the button unreadable.
  const [addHost, setAddHost] = useState<HTMLDivElement | null>(null);
  const addTone = useSurfaceTone(addHost, [inspect]);

  const sorted = useMemo(() => [...posts].sort(byNewestFirst), [posts]);
  const categories = useMemo(() => deriveBlogCategories(sorted), [sorted]);

  const filtered = useMemo(
    () =>
      sorted.filter(
        (post) =>
          (selectedFilter === ALL_POSTS_LABEL ||
            post.category?.trim() === selectedFilter) &&
          matchesBlogQuery(post, query),
      ),
    [sorted, selectedFilter, query],
  );

  const pageCount = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  // Clamped rather than stored-and-corrected: narrowing the filter can strand
  // `page` past the end, and a clamp keeps that from rendering an empty grid.
  const currentPage = Math.min(page, pageCount);
  const visible = filtered.slice(
    (currentPage - 1) * PER_PAGE,
    currentPage * PER_PAGE,
  );

  const filterOptions = [ALL_POSTS_LABEL, ...categories];

  return (
    <section className="bg-surface">
      <div className="mx-auto max-w-container px-6 py-[88px]">
        {/* Card titles are <h3>s; without this the page jumps h1 → h3. */}
        <h2 className="sr-only">Blog posts</h2>

        {inspect && widget ? (
          <div ref={setAddHost} className="mb-6">
            <button
              type="button"
              onClick={() => void widget.createEntry("blog-post")}
              className={
                addTone === "dark"
                  ? "zero-cms inline-flex items-center gap-2 rounded-lg border border-dashed border-white/50 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white/85 transition-colors hover:border-white hover:bg-white/15 hover:text-white"
                  : "zero-cms inline-flex items-center gap-2 rounded-lg border border-dashed border-neutral-400 bg-white px-4 py-2.5 text-sm font-semibold text-neutral-700 transition-colors hover:border-neutral-900 hover:text-neutral-900"
              }
            >
              <span
                aria-hidden
                className="flex h-5 w-5 items-center justify-center rounded-full border border-current leading-none"
              >
                +
              </span>
              New blog post
            </button>
          </div>
        ) : null}

        <div className="mb-6 max-w-md">
          <label htmlFor="blog-search" className="mb-1.5 block text-[13px] font-semibold text-dark">
            Search posts
          </label>
          <input
            id="blog-search"
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              // A new query means a new result set — page 2 of the old one is
              // meaningless, and staying there looks like "no results".
              setPage(1);
            }}
            placeholder="e.g. wetroom, underfloor heating"
            className="w-full rounded-full border-[1.5px] border-border bg-white px-4 py-2.5 text-sm text-dark transition-colors placeholder:text-muted focus:border-dark focus:outline-none"
          />
        </div>

        <div
          className="mb-9 flex flex-wrap gap-2"
          role="group"
          aria-label="Filter posts by category"
        >
          {filterOptions.map((label) => {
            const isActive = selectedFilter === label;

            return (
              <button
                key={label}
                type="button"
                aria-pressed={isActive}
                onClick={() => {
                  setSelectedFilter(label);
                  setPage(1);
                }}
                className={
                  isActive
                    ? "rounded-full border-[1.5px] border-dark bg-dark px-4 py-2 text-[13px] font-semibold text-white transition-colors"
                    : "rounded-full border-[1.5px] border-border bg-transparent px-4 py-2 text-[13px] font-semibold text-dark transition-colors hover:border-dark hover:bg-dark hover:text-white"
                }
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Result count is the only feedback a search has when it narrows the
            grid, and it announces politely so it isn't read on every keystroke. */}
        <p aria-live="polite" className="mb-4 text-[13px] text-muted">
          {filtered.length === 0
            ? "No posts match your search."
            : `${filtered.length} ${filtered.length === 1 ? "post" : "posts"}`}
        </p>

        {visible.length > 0 ? (
          <div className="grid gap-[18px] sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((post) =>
              // In flow beneath the card, not overlaid on it: the card already
              // grows a hover pencil cluster in its own top corner, and a second
              // floating control there fights it for the same pixels.
              inspect && widget ? (
                <div key={post.id} className="flex flex-col gap-2">
                  <BlogCard data={post} />

                  <button
                    type="button"
                    onClick={() =>
                      void widget.duplicate(post.id, DUPLICATE_BLOG_POST)
                    }
                    className="zero-cms inline-flex items-center justify-center gap-2 rounded-lg border border-dashed border-neutral-400 bg-white px-3 py-2 text-[13px] font-semibold text-neutral-700 transition-colors hover:border-neutral-900 hover:text-neutral-900"
                  >
                    <span aria-hidden>⧉</span>
                    Duplicate
                    {/* The title rides in the accessible name so a screen
                        reader listing controls doesn't hear "Duplicate" nine
                        times with nothing to tell them apart. */}
                    <span className="sr-only">
                      {post.title ? ` “${post.title}”` : ""}
                    </span>
                  </button>
                </div>
              ) : (
                <BlogCard key={post.id} data={post} />
              ),
            )}
          </div>
        ) : null}

        {pageCount > 1 ? (
          <nav className="mt-10 flex flex-wrap items-center gap-2" aria-label="Pagination">
            <button
              type="button"
              onClick={() => setPage(currentPage - 1)}
              disabled={currentPage === 1}
              className="rounded-full border-[1.5px] border-border px-3 py-2 text-[13px] font-semibold text-dark transition-colors hover:border-dark disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-border"
            >
              ‹ Previous
            </button>

            {Array.from({ length: pageCount }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setPage(n)}
                aria-current={n === currentPage ? "page" : undefined}
                aria-label={`Page ${n}`}
                className={
                  n === currentPage
                    ? "rounded-full border-[1.5px] border-dark bg-dark px-3.5 py-2 text-[13px] font-semibold text-white"
                    : "rounded-full border-[1.5px] border-border px-3.5 py-2 text-[13px] font-semibold text-dark transition-colors hover:border-dark hover:bg-dark hover:text-white"
                }
              >
                {n}
              </button>
            ))}

            <button
              type="button"
              onClick={() => setPage(currentPage + 1)}
              disabled={currentPage === pageCount}
              className="rounded-full border-[1.5px] border-border px-3 py-2 text-[13px] font-semibold text-dark transition-colors hover:border-dark disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-border"
            >
              Next ›
            </button>
          </nav>
        ) : null}
      </div>
    </section>
  );
}
