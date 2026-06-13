import { ContentfulEntry, ContentfulEntryField } from "@/components/contentful";
import { StaticStepFragment } from "@/generated/graphql";
import type { CSSProperties } from "react";

type StaticStepsProps = {
  steps: StaticStepFragment[];
};

function sortSteps(steps: StaticStepFragment[]) {
  return [...steps].sort((a, b) => {
    const orderA = Number.parseInt(a.stepOrder ?? "0", 10);
    const orderB = Number.parseInt(b.stepOrder ?? "0", 10);

    if (Number.isNaN(orderA) || Number.isNaN(orderB)) {
      return (a.stepOrder ?? "").localeCompare(b.stepOrder ?? "");
    }

    return orderA - orderB;
  });
}

function StepCircle({ order }: { order?: string | null }) {
  return (
    <span
      aria-hidden
      className="relative z-10 flex size-12 shrink-0 items-center justify-center rounded-full border-[3px] border-surface bg-dark font-serif text-lg text-white shadow-[0_0_0_2px_var(--color-dark)]"
    >
      {order}
    </span>
  );
}

function StepContent({
  step,
  titleClassName = "text-[15px] font-bold leading-snug text-dark",
  descriptionClassName = "mt-1 text-[13px] leading-[1.55] text-muted",
}: {
  step: StaticStepFragment;
  titleClassName?: string;
  descriptionClassName?: string;
}) {
  return (
    <>
      {step.stepTitle ? (
        <ContentfulEntryField field="stepTitle">
          <p className={titleClassName}>{step.stepTitle}</p>
        </ContentfulEntryField>
      ) : null}

      {step.stepDescription ? (
        <ContentfulEntryField field="stepDescription">
          <p className={descriptionClassName}>{step.stepDescription}</p>
        </ContentfulEntryField>
      ) : null}
    </>
  );
}

export function StaticSteps({ steps }: StaticStepsProps) {
  const sortedSteps = sortSteps(steps.filter(Boolean));
  const lastIndex = sortedSteps.length - 1;

  if (sortedSteps.length === 0) {
    return null;
  }

  return (
    <>
      {/* Mobile: vertical stepper */}
      <ol className="flex flex-col md:hidden" aria-label="Process steps">
        {sortedSteps.map((step, index) => (
          <ContentfulEntry key={step._id} entry={step}>
            <li className="flex gap-3.5">
              <div className="flex w-12 shrink-0 flex-col items-center">
                <ContentfulEntryField field="stepOrder" as="span">
                  <StepCircle order={step.stepOrder} />
                </ContentfulEntryField>

                {index < lastIndex ? (
                  <span
                    aria-hidden
                    className="my-1 w-px flex-1 min-h-4 bg-border"
                  />
                ) : null}
              </div>

              <div className={index < lastIndex ? "pb-5 pt-1.5" : "pt-1.5"}>
                <StepContent step={step} />
              </div>
            </li>
          </ContentfulEntry>
        ))}
      </ol>

      {/* Desktop: horizontal timeline */}
      <ol
        className="relative hidden md:grid md:grid-cols-[repeat(var(--step-count),minmax(0,1fr))] md:gap-0"
        style={{ "--step-count": sortedSteps.length } as CSSProperties}
        aria-label="Process steps"
      >
        <span
          aria-hidden
          className="pointer-events-none absolute top-[23px] right-[10%] left-[10%] z-0 h-0.5 bg-border"
        />

        {sortedSteps.map((step) => (
          <ContentfulEntry key={step._id} entry={step}>
            <li className="relative z-10 flex min-w-0 flex-col items-center px-4 text-center first:pl-0 last:pr-0">
              <ContentfulEntryField field="stepOrder" as="span">
                <StepCircle order={step.stepOrder} />
              </ContentfulEntryField>

              <div className="mt-4 w-full">
                <StepContent
                  step={step}
                  titleClassName="text-[15px] font-bold leading-snug text-dark"
                  descriptionClassName="mt-1.5 text-[13px] leading-[1.55] text-muted"
                />
              </div>
            </li>
          </ContentfulEntry>
        ))}
      </ol>
    </>
  );
}
