import { ZeroCmsEntry, ZeroCmsEntryField, ZeroCmsList } from "@usc/zero-cms-widget";
import type { ProjectDetailFragment } from "@/generated/graphql";

type Deliverable = NonNullable<
  NonNullable<ProjectDetailFragment["deliverables"]>[number]
>;

type ProjectScopeProps = {
  summary?: string | null;
  deliverables?: ProjectDetailFragment["deliverables"];
};

export function ProjectScope({ summary, deliverables }: ProjectScopeProps) {
  const items = (deliverables ?? []).filter(
    (d): d is Deliverable => Boolean(d),
  );

  if (!summary && items.length === 0) {
    return null;
  }

  return (
    <div>
      <p className="text-[11px] font-bold tracking-[0.14em] text-gold-deep uppercase">
        Project scope
      </p>
      <h2 className="mt-2 font-serif text-[clamp(28px,3.2vw,40px)] leading-tight text-dark">
        What we delivered
      </h2>

      {summary ? (
        <ZeroCmsEntryField field="deliveredSummary">
          <p className="mt-3 max-w-2xl leading-relaxed text-muted">{summary}</p>
        </ZeroCmsEntryField>
      ) : null}

      <ZeroCmsList
        className="relative mt-8 flex flex-col"
        field="deliverables"
        items={items}
      >
        {items.map((d, i) => (
          <ZeroCmsEntry key={d.id} entry={d}>
            <div className="flex gap-4 border-b border-border-light py-5 first:pt-0 last:border-0">
              <span
                aria-hidden
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-gold bg-gold-light text-xs font-bold leading-none text-gold"
              >
                {i + 1}
              </span>
              <div className="min-w-0 pt-1">
                <ZeroCmsEntryField field="title">
                  <h3 className="font-semibold text-dark">{d.title}</h3>
                </ZeroCmsEntryField>
                {d.description ? (
                  <ZeroCmsEntryField field="description">
                    <p className="mt-1 text-sm leading-relaxed text-muted">
                      {d.description}
                    </p>
                  </ZeroCmsEntryField>
                ) : null}
              </div>
            </div>
          </ZeroCmsEntry>
        ))}
      </ZeroCmsList>
    </div>
  );
}
