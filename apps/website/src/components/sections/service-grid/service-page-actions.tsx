"use client";

import { ZeroCmsEntryActions, useZeroCmsWidgetOptional } from "@usc/zero-cms-widget";
import {
  DUPLICATE_SERVICE_PAGE,
  SERVICE_TEMPLATE,
  saveAsTemplateOptions,
} from "@/components/cms/templates";
import { useSiteNavigate } from "@/components/cms/use-site-navigate";

export type ServiceGridRef = {
  id: string;
  type: string;
};

/**
 * A Service page's Publish / Unpublish / Duplicate / Save as template / Delete
 * row, at the top of the page while edit mode is on.
 *
 * A Service is two entries — this `page`, which owns the URL and the sections,
 * and a `service-card` on the Services index that links to it — and only the
 * pair is reachable. So Duplicate does what "New service" does: copy the page,
 * then put a card beside it on the grid. Without the card the copy is a page
 * nobody can navigate to; with it, the editor finds the copy exactly where they
 * find every other service.
 *
 * Delete is deliberately left to fail loudly when the card still points here:
 * zero-cms refuses to delete a referenced entry and the bar reports which entry
 * holds it. Silently deleting the card too would take a decision the editor did
 * not ask for — the card may be the thing they want to keep and re-point.
 */
export function ServicePageActions({
  title,
  grid,
}: {
  title?: string | null;
  grid?: ServiceGridRef | null;
}) {
  const navigate = useSiteNavigate();
  const widget = useZeroCmsWidgetOptional();

  const onDuplicated = async (pageId: string) => {
    if (!widget || !grid) return;
    // Silent, like the card "New service" makes: it has nothing to ask at this
    // moment, and a second drawer stacked behind the copy's own would be a form
    // the editor cannot fill in until the first is saved.
    const cardId = await widget.createDraft("service-card", {
      title: title ? `${title} (copy)` : "New service",
      page: pageId,
    });
    if (!cardId) return;
    await widget.link({
      parentId: grid.id,
      parentType: grid.type,
      parentField: "cards",
      childId: cardId,
    });
  };

  return (
    <ZeroCmsEntryActions
      noun="service page"
      className="mb-6"
      onDeleted={() => navigate("/services", { replace: true })}
      duplicateOptions={DUPLICATE_SERVICE_PAGE}
      // No navigation: the copy's slug is cleared (it would otherwise shadow
      // this page's URL), so there is nowhere to go until the editor sets one
      // in the drawer that just opened.
      onDuplicated={(id) => void onDuplicated(id)}
      templateOptions={saveAsTemplateOptions(SERVICE_TEMPLATE, title)}
    />
  );
}
