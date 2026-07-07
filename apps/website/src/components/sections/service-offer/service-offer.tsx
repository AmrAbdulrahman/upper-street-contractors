import {
  ZeroCmsEntry,
  ZeroCmsEntryField,
  ZeroCmsList,
} from "@usc/zero-cms-widget";
import { Cta } from "@/components/ui/cta";
import type { ServiceOfferSectionFragment } from "@/generated/graphql";

type ScopeItem = NonNullable<
  NonNullable<ServiceOfferSectionFragment["items"]>[number]
>;
type CostCard = NonNullable<
  NonNullable<ServiceOfferSectionFragment["costCards"]>[number]
>;

type ServiceOfferSectionProps = {
  data: ServiceOfferSectionFragment;
};

export function ServiceOfferSection({ data }: ServiceOfferSectionProps) {
  const { overline, title, intro, items, callout, costCards } = data;
  const scopeItems = (items ?? []).filter((d): d is ScopeItem => Boolean(d));
  const cards = (costCards ?? []).filter((c): c is CostCard => Boolean(c));

  return (
    <ZeroCmsEntry entry={data}>
      <section className="bg-surface">
        <div className="mx-auto max-w-container px-6 py-[88px]">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-14">
            <div>
              {overline ? (
                <ZeroCmsEntryField field="overline">
                  <p className="text-[11px] font-bold tracking-[0.14em] text-gold-deep uppercase">
                    {overline}
                  </p>
                </ZeroCmsEntryField>
              ) : null}

              {title ? (
                <ZeroCmsEntryField field="title">
                  <h2 className="mt-2 font-serif text-[clamp(28px,3.2vw,40px)] leading-tight text-dark">
                    {title}
                  </h2>
                </ZeroCmsEntryField>
              ) : null}

              {intro ? (
                <ZeroCmsEntryField field="intro">
                  <p className="mt-3 max-w-2xl leading-relaxed text-muted">
                    {intro}
                  </p>
                </ZeroCmsEntryField>
              ) : null}

              {scopeItems.length ? (
                <ZeroCmsList
                  className="relative mt-8 flex flex-col"
                  field="items"
                  items={scopeItems}
                >
                  {scopeItems.map((d, i) => (
                    <ZeroCmsEntry key={d.id} entry={d}>
                      <div className="flex gap-4 border-b border-border-light py-5 first:pt-0 last:border-0">
                        <span
                          aria-hidden
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-gold bg-gold-light text-xs font-bold leading-none text-gold"
                        >
                          {i + 1}
                        </span>
                        <div className="min-w-0 pt-1">
                          <ZeroCmsEntryField field="title">
                            <h3 className="font-semibold text-dark">{d.title}</h3>
                          </ZeroCmsEntryField>
                          {d.description ? (
                            <ZeroCmsEntryField field="description">
                              <p className="mt-1 text-sm leading-relaxed text-muted">
                                {d.description}
                              </p>
                            </ZeroCmsEntryField>
                          ) : null}
                        </div>
                      </div>
                    </ZeroCmsEntry>
                  ))}
                </ZeroCmsList>
              ) : null}

              {callout ? (
                <ZeroCmsEntryField field="callout">
                  <p className="mt-8 border-l-2 border-gold bg-gold-light/40 p-5 text-sm leading-relaxed text-dark/80">
                    {callout}
                  </p>
                </ZeroCmsEntryField>
              ) : null}
            </div>

            {cards.length ? (
              <ZeroCmsList
                className="flex flex-col gap-4 self-start lg:sticky lg:top-24"
                field="costCards"
                items={cards}
              >
                {cards.map((card) => (
                  <Cta key={card.id} variant="sidebar" data={card} />
                ))}
              </ZeroCmsList>
            ) : null}
          </div>
        </div>
      </section>
    </ZeroCmsEntry>
  );
}
