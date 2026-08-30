"use client";

import {
  TemplateActionProvider,
  ZeroCmsEntry,
  ZeroCmsEntryField,
  useInspect,
  useZeroCmsWidgetOptional,
} from "@usc/zero-cms-widget";
import { NewEntryButton } from "@/components/cms/new-entry-button";
import { SERVICE_TEMPLATE, saveAsTemplateOptions } from "@/components/cms/templates";
import { useCardFlash } from "@/components/cms/use-card-flash";
import { ServiceCard } from "./service-card";
import type { ServiceGridSectionFragment } from "@/generated/graphql";

type ServiceGridSectionProps = {
  data: ServiceGridSectionFragment;
};

/**
 * Client, unlike most section components, because "New service" and the
 * new-card flash both need browser state. Nothing below it is server-only —
 * ServiceCard is presentational, exactly like the ProjectCard it was modelled
 * on, which has always been a client component.
 */
export function ServiceGridSection({ data }: ServiceGridSectionProps) {
  const cards = data.cards?.filter(Boolean) ?? [];

  const widget = useZeroCmsWidgetOptional();
  const inspect = useInspect();
  const { flashId, flashOnClose } = useCardFlash(widget?.isOpen ?? false);

  /**
   * A Service is TWO entries: the `page` that holds its sections and owns its
   * URL, and the `service-card` that puts it on this grid and links to it. Only
   * this call site knows that, so it makes the second one itself.
   *
   * The template drawer opens on the **page**, because that is where the Slug
   * lives and a card pointing at a page with no slug falls back to /services.
   * The card is created silently with a placeholder name — it has nothing to
   * ask at that moment, and a second stacked drawer would be a form the editor
   * cannot fill in until the first is saved. Its own pencil renames it, and the
   * flash is what points them at it.
   */
  const onNewService = async () => {
    if (!widget) return;

    const pageId = await widget.createFromTemplate(SERVICE_TEMPLATE);
    if (!pageId) return;

    const cardId = await widget.createDraft("service-card", {
      title: "New service",
      page: pageId,
    });
    if (!cardId) return;

    await widget.link({
      parentId: data.id,
      parentType: data.type,
      parentField: "cards",
      childId: cardId,
    });

    flashOnClose(cardId);
  };

  return (
    <ZeroCmsEntry entry={data}>
      <section className="bg-surface">
        <div className="mx-auto max-w-container px-6 py-[88px]">
          {data.overline ? (
            <ZeroCmsEntryField field="overline">
              {/* `gold-deep`, not `gold`: this section sits on the light
                  `bg-surface`, where plain gold fails contrast (Lighthouse
                  a11y 96). The same distinction the What We Do overline makes. */}
              <p className="font-sans text-[13px] font-semibold tracking-[0.14em] text-gold-deep uppercase">
                {data.overline}
              </p>
            </ZeroCmsEntryField>
          ) : null}

          {data.title ? (
            <ZeroCmsEntryField field="title">
              <h2 className="mt-2 font-serif text-[2rem] leading-tight text-dark">
                {data.title}
              </h2>
            </ZeroCmsEntryField>
          ) : null}

          {/* The only way to add a Service, which is why the grid below is a
              plain container and not a <ZeroCmsList>: that wrapper ends the
              grid with a "+ Add" chip, and a chip can only link an existing
              card or mint a bare one — a card linking nowhere, which is the
              one Service nobody can reach. This makes the whole thing, a page
              from a template plus the card that reaches it. */}
          {widget ? (
            <div className="mt-10">
              <NewEntryButton label="New service" onClick={() => void onNewService()} />
            </div>
          ) : null}

          <div className="mt-10 grid gap-[18px] sm:grid-cols-2 lg:grid-cols-3">
            {cards.map((card, index) =>
              // The first row is above the fold on every viewport this grid has
              // (1 / 2 / 3 columns), and Next lazy-loads by default — which made
              // the top-left photo the Largest Contentful Paint *and* deferred
              // it. Three covers the widest row without preloading the rest.
              //
              // The provider emits no DOM, so each card stays a direct grid
              // item. Only offered once the card has a page: the sections worth
              // templating live there, so a card linking nowhere has nothing to
              // snapshot.
              inspect && widget && card.page?.id ? (
                <TemplateActionProvider
                  key={card.id}
                  value={{
                    ...saveAsTemplateOptions(SERVICE_TEMPLATE, card.title),
                    sourceId: card.page.id,
                    noun: card.title ? `service “${card.title}”` : "service",
                  }}
                >
                  <ServiceCard
                    data={card}
                    priority={index < 3}
                    flash={card.id === flashId}
                  />
                </TemplateActionProvider>
              ) : (
                <ServiceCard
                  key={card.id}
                  data={card}
                  priority={index < 3}
                  flash={card.id === flashId}
                />
              ),
            )}
          </div>

          {cards.length === 0 ? (
            <p className="mt-10 text-base text-muted">No services listed yet.</p>
          ) : null}
        </div>
      </section>
    </ZeroCmsEntry>
  );
}
