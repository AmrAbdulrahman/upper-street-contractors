"use client";

import { useRouter } from "next/navigation";
import { ZeroCmsEntryActions } from "@usc/zero-cms-widget";

/**
 * The post's own Publish / Unpublish / Delete row, shown at the top of a Blog
 * Post while edit mode is on (and nothing at all otherwise).
 *
 * Mirrors the Blog index's "New blog post" button: a Blog Post is queried by
 * Type rather than held in any parent's relation field, so it inherits none of
 * the Section builder's affordances — without these, the only way to publish or
 * delete the post you are looking at is to leave for the Content admin.
 *
 * Client-only because it writes through the adapter; `useRouter` is the reason it
 * can't live in `BlogPostHeader` itself, which is a server component.
 */
export function BlogPostActions() {
  const router = useRouter();

  return (
    <ZeroCmsEntryActions
      noun="post"
      className="mb-6"
      // `replace`, not `push`: the deleted post's URL must not sit in history as
      // a back-button trap to a 404.
      onDeleted={() => router.replace("/blog")}
    />
  );
}
