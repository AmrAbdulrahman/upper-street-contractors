import {
  AddContentfulEntry,
  ContentfulEntry,
  ContentfulEntryField,
} from "@/components/contentful";
import { RichText } from "@/components/contentful/rich-text";
import { Banner } from "@/components/ui/banner";
import { StaticSteps } from "@/components/ui/static-steps";
import { HowItWorksSectionFragment } from "@/generated/graphql";
import type { Document } from "@contentful/rich-text-types";

type HowItWorksSectionProps = {
  data: HowItWorksSectionFragment;
};

export function HowItWorksSection({ data }: HowItWorksSectionProps) {
  const { overline, title, sectionSummary, processListCollection, sectionBanner } =
    data;
  const summaryDocument = sectionSummary?.json as Document | undefined;
  const steps = processListCollection?.items?.filter(Boolean) ?? [];

  return (
    <ContentfulEntry entry={data}>
      <section className="bg-surface">
        <div className="mx-auto max-w-container px-6 py-[88px]">
          <div className="mx-auto max-w-2xl text-center">
            {overline ? (
              <ContentfulEntryField field="overline">
                <p className="text-[11px] font-bold tracking-[0.12em] text-gold uppercase">
                  {overline}
                </p>
              </ContentfulEntryField>
            ) : null}

            {title ? (
              <ContentfulEntryField field="title">
                <h2 className="mt-2.5 text-[clamp(26px,3.5vw,42px)] leading-tight text-dark">
                  {title}
                </h2>
              </ContentfulEntryField>
            ) : null}

            {summaryDocument ? (
              <ContentfulEntryField field="sectionSummary" className="mt-4">
                <RichText
                  document={summaryDocument}
                  variant="what-we-do-body"
                  className="mx-auto mt-2.5 flex flex-col gap-4"
                />
              </ContentfulEntryField>
            ) : null}
          </div>

          {steps.length > 0 ? (
            <div className="mt-12">
              <StaticSteps steps={steps} />
              <AddContentfulEntry field="processList" />
            </div>
          ) : null}

          {sectionBanner ? (
            <div className="mt-10">
              <ContentfulEntryField field="sectionBanner">
                <Banner data={sectionBanner} />
              </ContentfulEntryField>
            </div>
          ) : null}
        </div>
      </section>
    </ContentfulEntry>
  );
}
