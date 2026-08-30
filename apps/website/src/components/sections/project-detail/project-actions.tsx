"use client";

import { ZeroCmsEntryActions } from "@usc/zero-cms-widget";
import {
  DUPLICATE_PROJECT,
  PROJECT_TEMPLATE,
  saveAsTemplateOptions,
} from "@/components/cms/templates";
import { useSiteNavigate } from "@/components/cms/use-site-navigate";

/**
 * A Project's own Publish / Unpublish / Duplicate / Save as template / Delete
 * row, at the top of its page while edit mode is on.
 *
 * The same row a Blog Post carries, for the same reason: a Project is queried
 * by Type rather than held in any parent's relation field, so it inherits none
 * of the Section builder's affordances and the Projects index's card cluster is
 * the only other place these actions exist.
 */
export function ProjectActions({ title }: { title?: string | null }) {
  const navigate = useSiteNavigate();

  return (
    <ZeroCmsEntryActions
      noun="project"
      className="mb-6"
      // `replace`, not `push`: the deleted Project's URL must not sit in history
      // as a back-button trap to a 404.
      onDeleted={() => navigate("/projects", { replace: true })}
      duplicateOptions={DUPLICATE_PROJECT}
      // A Project's URL is its id, so unlike a Blog Post there IS somewhere to
      // send the editor — the copy's own page, which the copy's drawer is
      // already open over.
      onDuplicated={(id) => navigate(`/projects/${id}`)}
      templateOptions={saveAsTemplateOptions(PROJECT_TEMPLATE, title)}
    />
  );
}
