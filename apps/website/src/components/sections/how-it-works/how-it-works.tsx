import {
  AddStrapiEntry,
  StrapiEntry,
  StrapiEntryField,
} from "@/components/strapi";
import { RichText } from "@/components/strapi/rich-text";
import { Banner } from "@/components/ui/banner";
import { StaticSteps } from "@/components/ui/static-steps";
import { HowItWorksSectionFragment } from "@/generated/graphql";

type HowItWorksSectionProps = {
  data: HowItWorksSectionFragment;
};

export function HowItWorksSection({ data }: HowItWorksSectionProps) {
  const { overline, title, sectionSummary, processList, sectionBanner } = data;
  const steps = processList?.filter(Boolean) ?? [];

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

            {sectionSummary ? (
              <StrapiEntryField field="sectionSummary" className="mt-4">
                <RichText
                  content={sectionSummary}
                  variant="what-we-do-body"
                  className="mx-auto mt-2.5 flex flex-col gap-4"
                />
              </StrapiEntryField>
            ) : null}
          </div>

          {steps.length > 0 ? (
            <div className="mt-12">
              <StaticSteps steps={steps} />
              <AddStrapiEntry field="processList" />
            </div>
          ) : null}

          {sectionBanner ? (
            <div className="mt-10">
              <StrapiEntryField field="sectionBanner">
                <Banner data={sectionBanner} />
              </StrapiEntryField>
            </div>
          ) : null}
        </div>
      </section>
    </StrapiEntry>
  );
}
