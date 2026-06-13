import { AddContentfulEntry, ContentfulEntry, ContentfulEntryField } from "@/components/contentful";
import { RichText } from "@/components/contentful/rich-text";
import { Banner } from "@/components/ui/banner";
import { WorkCard } from "@/components/ui/work-card";
import { WhatWeDoSectionFragment } from "@/generated/graphql";
import type { Document } from "@contentful/rich-text-types";

type WhatWeDoSectionProps = {
  data: WhatWeDoSectionFragment;
};

export function WhatWeDoSection({ data }: WhatWeDoSectionProps) {
  const { overline, title, body, workCardsCollection, banner } = data;
  const bodyDocument = body?.json as Document | undefined;
  const workCards = workCardsCollection?.items?.filter(Boolean) ?? [];

  return (
    <ContentfulEntry entry={data}>
      <section className="bg-surface">
        <div className="mx-auto max-w-container px-6 py-[88px]">
          <div className="mx-auto  text-center">
            {overline ? (
              <ContentfulEntryField field="overline">
                <p className="text-[11px] font-bold tracking-[0.12em] text-gold uppercase">
                  {overline}
                </p>
              </ContentfulEntryField>
            ) : null}

            {title ? (
              <ContentfulEntryField field="title">
                <h2 className="mt-2.5 text-[2rem] leading-tight text-dark">
                  {title}
                </h2>
              </ContentfulEntryField>
            ) : null}

            {bodyDocument ? (
              <ContentfulEntryField field="body" className="mt-4">
                <RichText
                  document={bodyDocument}
                  variant="what-we-do-body"
                  className="flex flex-col gap-4 mt-2.5"
                />
              </ContentfulEntryField>
            ) : null}
          </div>

          {workCards.length > 0 ? (
            <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {workCards.map((card) =>
                card ? <WorkCard key={card._id} data={card} /> : null,
              )}

              <AddContentfulEntry field="workCards" />
            </div>
          ) : null}

          {banner ? (
            <div className="mt-10">
              <ContentfulEntryField field="banner">
                <Banner data={banner} />
              </ContentfulEntryField>
            </div>
          ) : null}
        </div>
      </section>
    </ContentfulEntry>
  );
}
