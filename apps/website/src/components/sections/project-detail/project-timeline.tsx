import { ZeroCmsEntry, ZeroCmsEntryField, ZeroCmsList } from "@usc/zero-cms-widget";
import type { ProjectDetailFragment } from "@/generated/graphql";

type Step = NonNullable<
  NonNullable<ProjectDetailFragment["projectTimeline"]>[number]
>;

type ProjectTimelineProps = {
  steps?: ProjectDetailFragment["projectTimeline"];
};

export function ProjectTimeline({ steps }: ProjectTimelineProps) {
  const items = (steps ?? []).filter((s): s is Step => Boolean(s));

  if (items.length === 0) {
    return null;
  }

  return (
    <section className="mt-16">
      <p className="text-[11px] font-bold tracking-[0.14em] text-gold uppercase">
        How it worked
      </p>
      <h2 className="mt-2 font-serif text-[clamp(24px,2.6vw,32px)] leading-tight text-dark">
        Project timeline
      </h2>

      <ZeroCmsList
        className="relative mt-8 grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-4"
        field="projectTimeline"
        items={items}
      >
        {/* connecting line (desktop) */}
        <span
          aria-hidden
          className="pointer-events-none absolute top-6 right-6 left-6 hidden h-px bg-border md:block"
        />
        {items.map((s) => (
          <ZeroCmsEntry key={s.id} entry={s}>
            <div className="relative text-center">
              <span
                aria-hidden
                className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-dark px-1 text-center font-serif text-[11px] leading-none text-white ring-4 ring-surface"
              >
                {s.step}
              </span>
              <ZeroCmsEntryField field="title">
                <h3 className="mt-3 text-sm font-semibold text-dark">
                  {s.title}
                </h3>
              </ZeroCmsEntryField>
              {s.description ? (
                <ZeroCmsEntryField field="description">
                  <p className="mt-1 text-xs leading-relaxed text-muted">
                    {s.description}
                  </p>
                </ZeroCmsEntryField>
              ) : null}
            </div>
          </ZeroCmsEntry>
        ))}
      </ZeroCmsList>
    </section>
  );
}
