import { ZeroCmsEntry, ZeroCmsEntryField, ZeroCmsList } from "@usc/zero-cms-widget";
import type { ProjectScopeSectionFragment } from "@/generated/graphql";

type ProjectScopeSectionProps = {
  data: ProjectScopeSectionFragment;
};

/**
 * What We Delivered — a completed Project's scope, as a numbered list of
 * Deliverables under a short intro.
 *
 * It was four fields on the Project itself (`deliveredSummary` + `deliverables`)
 * rendered by the project route. It is a section now, for the reason every other
 * block on the site is one: a Project is composed the same way a page is, so the
 * one thing that used to be un-reorderable and un-templatable is neither.
 *
 * Past tense, and deliberately not merged with the Service Offer section it
 * looks like: that one is an offer ("what we do for you"), this one is a record
 * ("what we did here").
 */
export function ProjectScopeSection({ data }: ProjectScopeSectionProps) {
  const { overline, title, summary } = data;
  const items = (data.deliverables ?? []).filter(
    (d): d is NonNullable<typeof d> => Boolean(d),
  );

  if (!summary && items.length === 0) return null;

  return (
    <ZeroCmsEntry entry={data}>
      <section className="bg-surface">
        <div className="mx-auto max-w-container px-6 py-[72px]">
          {overline ? (
            <ZeroCmsEntryField field="overline">
              {/* `gold-deep`, not `gold`: this sits on the light `bg-surface`,
                  where plain gold fails AA contrast. */}
              <p className="text-[11px] font-bold tracking-[0.14em] text-gold-deep uppercase">
                {overline}
              </p>
            </ZeroCmsEntryField>
          ) : null}

          {title ? (
            <ZeroCmsEntryField field="title">
              <h2 className="mt-2 font-serif text-[clamp(28px,3.2vw,40px)] leading-tight text-dark">
                {title}
              </h2>
            </ZeroCmsEntryField>
          ) : null}

          {summary ? (
            <ZeroCmsEntryField field="summary">
              <p className="mt-3 max-w-2xl leading-relaxed text-muted">{summary}</p>
            </ZeroCmsEntryField>
          ) : null}

          <ZeroCmsList
            className="relative mt-8 flex max-w-3xl flex-col"
            field="deliverables"
            items={items}
          >
            {items.map((deliverable, i) => (
              <ZeroCmsEntry key={deliverable.id} entry={deliverable}>
                <div className="flex gap-4 border-b border-border-light py-5 first:pt-0 last:border-0">
                  <span
                    aria-hidden
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-gold bg-gold-light text-xs font-bold leading-none text-gold"
                  >
                    {i + 1}
                  </span>
                  <div className="min-w-0 pt-1">
                    <ZeroCmsEntryField field="title">
                      <h3 className="font-semibold text-dark">{deliverable.title}</h3>
                    </ZeroCmsEntryField>
                    {deliverable.description ? (
                      <ZeroCmsEntryField field="description">
                        <p className="mt-1 text-sm leading-relaxed text-muted">
                          {deliverable.description}
                        </p>
                      </ZeroCmsEntryField>
                    ) : null}
                  </div>
                </div>
              </ZeroCmsEntry>
            ))}
          </ZeroCmsList>
        </div>
      </section>
    </ZeroCmsEntry>
  );
}
