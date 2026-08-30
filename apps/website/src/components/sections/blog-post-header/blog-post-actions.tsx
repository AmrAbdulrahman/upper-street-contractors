"use client";

import { ZeroCmsEntryActions } from "@usc/zero-cms-widget";
import {
  BLOG_TEMPLATE,
  DUPLICATE_BLOG_POST,
  saveAsTemplateOptions,
} from "@/components/cms/templates";
import { useSiteNavigate } from "@/components/cms/use-site-navigate";

/**
 * The post's own Publish / Unpublish / Duplicate / Save as template / Delete
 * row, shown at the top of a Blog Post while edit mode is on (and nothing at
 * all otherwise).
 *
 * Mirrors the Blog index's card cluster: a Blog Post is queried by Type rather
 * than held in any parent's relation field, so it inherits none of the Section
 * builder's affordances — without these, the only way to publish or delete the
 * post you are looking at is to leave for the Content admin, and the only way
 * to copy one is to go back to the index and find its card.
 *
 * Client-only because it writes through the adapter; the router is the reason it
 * can't live in `BlogPostHeader` itself, which is a server component.
 */
export function BlogPostActions({ title }: { title?: string | null }) {
  const navigate = useSiteNavigate();

  return (
    <ZeroCmsEntryActions
      noun="post"
      className="mb-6"
      // `replace`, not `push`: the deleted post's URL must not sit in history as
      // a back-button trap to a 404.
      onDeleted={() => navigate("/blog", { replace: true })}
      duplicateOptions={DUPLICATE_BLOG_POST}
      // Deliberately no navigation: the copy's slug is cleared (ADR 0017) and
      // only re-derives on save, so there is no URL to send anyone to yet. The
      // copy opens in its drawer, which is where the renaming happens anyway.
      templateOptions={saveAsTemplateOptions(BLOG_TEMPLATE, title)}
    />
  );
}
