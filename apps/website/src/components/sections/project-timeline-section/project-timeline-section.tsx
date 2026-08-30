import { ZeroCmsEntry, ZeroCmsEntryField, ZeroCmsList } from "@usc/zero-cms-widget";
import type { ProjectTimelineSectionFragment } from "@/generated/graphql";

type ProjectTimelineSectionProps = {
  data: ProjectTimelineSectionFragment;
};

/**
 * The Project Timeline — how a job progressed, as ordered Timeline Steps.
 *
 * Was `project.projectTimeline`, rendered only by the project route; now a
 * section, so it can be reordered, dropped from a Project that has nothing
 * staged, and carried by a Template.
 */
export function ProjectTimelineSection({ data }: ProjectTimelineSectionProps) {
  const { overline, title } = data;
  const items = (data.steps ?? []).filter((s): s is NonNullable<typeof s> => Boolean(s));

  if (items.length === 0) return null;

  return (
    <ZeroCmsEntry entry={data}>
      <section className="bg-surface">
        <div className="mx-auto max-w-container px-6 pb-[72px]">
          {overline ? (
            <ZeroCmsEntryField field="overline">
              <p className="text-[11px] font-bold tracking-[0.14em] text-gold-deep uppercase">
                {overline}
              </p>
            </ZeroCmsEntryField>
          ) : null}

          {title ? (
            <ZeroCmsEntryField field="title">
              <h2 className="mt-2 font-serif text-[clamp(24px,2.6vw,32px)] leading-tight text-dark">
                {title}
              </h2>
            </ZeroCmsEntryField>
          ) : null}

          {/* The connecting line is a SIBLING of the list, not a child of it:
              <ZeroCmsList> pairs `items` with its children by index, so a
              decorative first child ate slot 0 and silently dropped the last
              step off every four-step timeline. */}
          <div className="relative mt-8">
            <span
              aria-hidden
              className="pointer-events-none absolute top-6 right-6 left-6 hidden h-px bg-border md:block"
            />

            <ZeroCmsList
              className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-4"
              field="steps"
              items={items}
            >
              {items.map((step) => (
                <ZeroCmsEntry key={step.id} entry={step}>
                  <div className="relative text-center">
                    <span
                      aria-hidden
                      className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-dark px-1 text-center font-serif text-[11px] leading-none text-white ring-2 ring-dark ring-offset-2 ring-offset-surface"
                    >
                      {step.step}
                    </span>
                    <ZeroCmsEntryField field="title">
                      <h3 className="mt-3 text-sm font-semibold text-dark">{step.title}</h3>
                    </ZeroCmsEntryField>
                    {step.description ? (
                      <ZeroCmsEntryField field="description">
                        <p className="mt-1 text-xs leading-relaxed text-muted">
                          {step.description}
                        </p>
                      </ZeroCmsEntryField>
                    ) : null}
                  </div>
                </ZeroCmsEntry>
              ))}
            </ZeroCmsList>
          </div>
        </div>
      </section>
    </ZeroCmsEntry>
  );
}
