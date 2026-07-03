import { AddZeroCmsEntry, ZeroCmsEntry, ZeroCmsEntryField } from "@usc/zero-cms-widget";
import { RichTextViewer } from "@/components/ui/rich-text-viewer";
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
    <ZeroCmsEntry entry={data}>
      <section className="bg-surface">
        <div className="mx-auto max-w-container px-6 py-[88px]">
          <div className="mx-auto  text-center">
            {overline ? (
              <ZeroCmsEntryField field="overline">
                <p className="text-[11px] font-bold tracking-[0.12em] text-gold uppercase">
                  {overline}
                </p>
              </ZeroCmsEntryField>
            ) : null}

            {title ? (
              <ZeroCmsEntryField field="title">
                <h2 className="mt-2.5 text-[2rem] leading-tight text-dark">
                  {title}
                </h2>
              </ZeroCmsEntryField>
            ) : null}

            {body ? (
              <ZeroCmsEntryField field="body" className="mt-4">
                <RichTextViewer
                  content={body}
                  variant="what-we-do-body"
                  className="flex flex-col gap-4 mt-2.5"
                />
              </ZeroCmsEntryField>
            ) : null}
          </div>

          {workCardItems.length > 0 ? (
            <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {workCardItems.map((card) =>
                card ? <WorkCard key={card.id} data={card} /> : null,
              )}

              <AddZeroCmsEntry field="workCards" />
            </div>
          ) : null}

          {/* Banner self-wraps in its own ZeroCmsEntry → opens the banner entry. */}
          {banner ? (
            <div className="mt-10">
              <Banner data={banner} />
            </div>
          ) : null}
        </div>
      </section>
    </ZeroCmsEntry>
  );
}
