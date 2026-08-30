"use client";

import { useState } from "react";
import { useInspect, useSurfaceTone } from "@usc/zero-cms-widget";

type NewEntryButtonProps = {
  /** Reads as the whole action: "New blog post", "New project", "New service". */
  label: string;
  onClick: () => void;
};

/**
 * The inspect-only "+ New …" control above a card grid.
 *
 * A Blog Post, a Project and a Service page are all queried by Type rather than
 * held in some parent's relation field, so none of them inherits the Section
 * builder's "+ Add" affordance — without a button like this the only way to
 * start one is to leave the site for the Content admin.
 *
 * Extracted when the second and third grid needed it. The dashed border is the
 * Section builder's own idiom for "this is editing chrome, not page content",
 * and the tone is MEASURED rather than assumed: `/blog` is `bg-surface` and
 * `/services` sits on whatever the page's sections put behind it, so a
 * hardcoded palette would be unreadable on one of them.
 */
export function NewEntryButton({ label, onClick }: NewEntryButtonProps) {
  // `useInspect`, not `widget.inspect`: this is markup the server never sent,
  // and the context flag flips before deep subtrees finish hydrating.
  const inspect = useInspect();
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  const tone = useSurfaceTone(host, [inspect]);

  if (!inspect) return null;

  return (
    <div ref={setHost} className="mb-6">
      <button
        type="button"
        onClick={onClick}
        className={
          tone === "dark"
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
        {label}
      </button>
    </div>
  );
}
