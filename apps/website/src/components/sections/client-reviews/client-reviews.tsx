import {
  AddStrapiEntry,
  StrapiEntry,
  StrapiEntryField,
} from "@/components/strapi";
import { Button } from "@/components/ui/button";
import { ReviewCard } from "@/components/ui/review-card";
import { ClientReviewSectionFragment } from "@/generated/graphql";

type ClientReviewsSectionProps = {
  data: ClientReviewSectionFragment;
};

export function ClientReviewsSection({ data }: ClientReviewsSectionProps) {
  const { overline, title, description, reviewCards, reviewLinks } = data;
  const cards = reviewCards?.filter(Boolean) ?? [];
  const links = reviewLinks?.filter(Boolean) ?? [];

  return (
    <StrapiEntry entry={data}>
      <section className="bg-surface">
        <div className="mx-auto max-w-container px-6 py-[88px]">
          <div className="mx-auto max-w-2xl text-center">
            {overline ? (
              <StrapiEntryField field="overline">
                <p className="text-[11px] font-bold tracking-[0.12em] text-gold uppercase">
                  {overline}
                </p>
              </StrapiEntryField>
            ) : null}

            {title ? (
              <StrapiEntryField field="title">
                <h2 className="mt-2.5 text-[clamp(26px,3.5vw,42px)] leading-tight text-dark">
                  {title}
                </h2>
              </StrapiEntryField>
            ) : null}

            {description ? (
              <StrapiEntryField field="description">
                <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-muted">
                  {description}
                </p>
              </StrapiEntryField>
            ) : null}
          </div>

          {cards.length > 0 ? (
            <div className="mt-12 grid gap-[18px] sm:grid-cols-2 lg:grid-cols-3">
              {cards.map((card) =>
                card ? <ReviewCard key={card.documentId} data={card} /> : null,
              )}

              <AddStrapiEntry field="reviewCards" />
            </div>
          ) : null}

          {links.length > 0 ? (
            <div className="mt-9 flex flex-wrap justify-center gap-3">
              {links.map((link) =>
                link ? (
                  <StrapiEntryField key={link.documentId} field="reviewLinks">
                    <Button data={link} />
                  </StrapiEntryField>
                ) : null,
              )}
            </div>
          ) : null}
        </div>
      </section>
    </StrapiEntry>
  );
}
