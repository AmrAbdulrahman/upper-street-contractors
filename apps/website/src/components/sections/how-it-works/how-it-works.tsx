import {
  AddZeroCmsEntry,
  ZeroCmsEntry,
  ZeroCmsEntryField,
} from "@usc/zero-cms-widget";
import { RichTextViewer } from "@/components/ui/rich-text-viewer";
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
    <ZeroCmsEntry entry={data}>
      <section className="bg-surface">
        <div className="mx-auto max-w-container px-6 py-[88px]">
          <div className="mx-auto max-w-2xl text-center">
            {overline ? (
              <ZeroCmsEntryField field="overline">
                <p className="text-[11px] font-bold tracking-[0.12em] text-gold uppercase">
                  {overline}
                </p>
              </ZeroCmsEntryField>
            ) : null}

            {title ? (
              <ZeroCmsEntryField field="title">
                <h2 className="mt-2.5 text-[clamp(26px,3.5vw,42px)] leading-tight text-dark">
                  {title}
                </h2>
              </ZeroCmsEntryField>
            ) : null}

            {sectionSummary ? (
              <ZeroCmsEntryField field="sectionSummary" className="mt-4">
                <RichTextViewer
                  content={sectionSummary}
                  variant="what-we-do-body"
                  className="mx-auto mt-2.5 flex flex-col gap-4"
                />
              </ZeroCmsEntryField>
            ) : null}
          </div>

          {steps.length > 0 ? (
            <div className="mt-12">
              <StaticSteps steps={steps} />
              <AddZeroCmsEntry field="processList" />
            </div>
          ) : null}

          {/* Banner self-wraps in its own ZeroCmsEntry → opens the banner entry. */}
          {sectionBanner ? (
            <div className="mt-10">
              <Banner data={sectionBanner} />
            </div>
          ) : null}
        </div>
      </section>
    </ZeroCmsEntry>
  );
}
