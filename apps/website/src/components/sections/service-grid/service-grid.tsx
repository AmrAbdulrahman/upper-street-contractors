import { ZeroCmsEntry, ZeroCmsEntryField, ZeroCmsList } from "@usc/zero-cms-widget";
import { ServiceCard } from "./service-card";
import type { ServiceGridSectionFragment } from "@/generated/graphql";

type ServiceGridSectionProps = {
  data: ServiceGridSectionFragment;
};

export function ServiceGridSection({ data }: ServiceGridSectionProps) {
  // Filtered once, before the map: <ZeroCmsList> pairs `items` with its children
  // by index, so a filter inside the map would misalign every pencil after the
  // first gap.
  const cards = data.cards?.filter(Boolean) ?? [];

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

          <ZeroCmsList
            className="mt-10 grid gap-[18px] sm:grid-cols-2 lg:grid-cols-3"
            field="cards"
            items={cards}
          >
            {cards.map((card, index) => (
              // The first row is above the fold on every viewport this grid has
              // (1 / 2 / 3 columns), and Next lazy-loads by default — which made
              // the top-left photo the Largest Contentful Paint *and* deferred
              // it. Three covers the widest row without preloading the rest.
              <ServiceCard key={card.id} data={card} priority={index < 3} />
            ))}
          </ZeroCmsList>

          {cards.length === 0 ? (
            <p className="mt-10 text-base text-muted">No services listed yet.</p>
          ) : null}
        </div>
      </section>
    </ZeroCmsEntry>
  );
}
