import { AddStrapiEntry, StrapiEntry, StrapiEntryField } from "@/components/strapi";
import { RichText } from "@/components/strapi/rich-text";
import { Banner } from "@/components/ui/banner";
import { WorkCard } from "@/components/ui/work-card";
import { WhatWeDoSectionFragment } from "@/generated/graphql";

type WhatWeDoSectionProps = {
  data: WhatWeDoSectionFragment;
};

export function WhatWeDoSection({ data }: WhatWeDoSectionProps) {
  const { overline, title, body, workCards, banner } = data;
  const workCardItems = workCards?.filter(Boolean) ?? [];

  return (
    <StrapiEntry entry={data}>
      <section className="bg-surface">
        <div className="mx-auto max-w-container px-6 py-[88px]">
          <div className="mx-auto  text-center">
            {overline ? (
              <StrapiEntryField field="overline">
                <p className="text-[11px] font-bold tracking-[0.12em] text-gold uppercase">
                  {overline}
                </p>
              </StrapiEntryField>
            ) : null}

            {title ? (
              <StrapiEntryField field="title">
                <h2 className="mt-2.5 text-[2rem] leading-tight text-dark">
                  {title}
                </h2>
              </StrapiEntryField>
            ) : null}

            {body ? (
              <StrapiEntryField field="body" className="mt-4">
                <RichText
                  content={body}
                  variant="what-we-do-body"
                  className="flex flex-col gap-4 mt-2.5"
                />
              </StrapiEntryField>
            ) : null}
          </div>

          {workCardItems.length > 0 ? (
            <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {workCardItems.map((card) =>
                card ? <WorkCard key={card.documentId} data={card} /> : null,
              )}

              <AddStrapiEntry field="workCards" />
            </div>
          ) : null}

          {banner ? (
            <div className="mt-10">
              <StrapiEntryField field="banner">
                <Banner data={banner} />
              </StrapiEntryField>
            </div>
          ) : null}
        </div>
      </section>
    </StrapiEntry>
  );
}
