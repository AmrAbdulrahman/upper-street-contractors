import { Cta } from "@/components/ui/cta";
import type { CtaFragment, ProjectDetailFragment } from "@/generated/graphql";
import { durationDays } from "@/helpers/project-meta";
import { ZeroCmsEntry, ZeroCmsEntryField } from "@usc/zero-cms-widget";
import Link from "next/link";

const GUARANTEE = "12-month workmanship";

type ClientComment = NonNullable<
  NonNullable<ProjectDetailFragment["clientComments"]>[number]
>;

function durationStat(
  begin?: string | null,
  end?: string | null,
): { value: string; unit: string } | null {
  const d = durationDays(begin, end);
  if (d == null) return null;
  if (d < 84) return { value: String(Math.round(d / 7)), unit: "wks" };
  return { value: String(Math.round(d / 30.44)), unit: "mo" };
}

function Stat({
  value,
  unit,
  label,
  field,
}: {
  value: string;
  unit?: string;
  label: string;
  field?: string;
}) {
  const card = (
    <div className="rounded-lg border border-white/5 bg-white/[0.06] px-4 py-3">
      <p className="font-serif text-3xl leading-none text-white">
        {value}
        {unit ? <span className="text-gold-mid">{unit}</span> : null}
      </p>
      <p className="mt-1.5 text-[11px] font-semibold tracking-wide text-subtle uppercase">
        {label}
      </p>
    </div>
  );

  return field ? <ZeroCmsEntryField field={field}>{card}</ZeroCmsEntryField> : card;
}

function Detail({
  label,
  value,
  field,
}: {
  label: string;
  value: string;
  field?: string;
}) {
  const row = (
    <p className="text-[13px] text-white/60">
      <span className="font-semibold text-white/90">{label}:</span> {value}
    </p>
  );

  return field ? <ZeroCmsEntryField field={field}>{row}</ZeroCmsEntryField> : row;
}

type ProjectGlanceProps = {
  project: ProjectDetailFragment;
  quote?: ClientComment | null;
  sidebarCta?: CtaFragment | null;
};

export function ProjectGlance({ project, quote, sidebarCta }: ProjectGlanceProps) {
  const dur = durationStat(project.beginDate, project.endDate);
  const scopeCount = (project.deliverables ?? []).filter(Boolean).length;
  const rating = project.clientRating;
  const type = project.subCategory ?? project.category ?? null;
  const occupancy = project.occupancy ?? "Occupied throughout";

  return (
    <div className="flex flex-col gap-4 lg:sticky lg:top-24">
      <div className="rounded-xl border border-white/10 bg-dark p-6 text-white shadow-lg">
        <p className="text-[11px] font-semibold tracking-[0.12em] text-gold-mid uppercase">
          Project at a glance
        </p>

        <div className="mt-4 grid grid-cols-2 gap-3">
          {dur ? <Stat value={dur.value} unit={dur.unit} label="Duration" /> : null}
          {project.projectValue ? (
            <Stat value={project.projectValue} label="Project value" field="projectValue" />
          ) : null}
          {scopeCount ? (
            <Stat value={String(scopeCount)} label="Scope items" />
          ) : null}
          {rating != null ? (
            <Stat value={`★${rating}`} label="Client rating" field="clientRating" />
          ) : null}
        </div>

        <div className="mt-5 space-y-1.5 border-t border-white/10 pt-4">
          {type ? <Detail label="Type" value={type} field="subCategory" /> : null}
          {project.location ? (
            <Detail label="Location" value={project.location} field="location" />
          ) : null}
          <Detail label="Occupancy" value={occupancy} field="occupancy" />
          <Detail label="Guarantee" value={GUARANTEE} />
        </div>
      </div>

      {quote?.comment ? (
        <ZeroCmsEntry entry={quote}>
          <figure className="rounded-xl border-l-2 border-gold bg-white p-5 shadow-sm">
            <ZeroCmsEntryField field="comment">
              <blockquote className="text-sm leading-relaxed text-dark/80">
                {`“${quote.comment}”`}
              </blockquote>
            </ZeroCmsEntryField>
            {quote.name ? (
              <ZeroCmsEntryField field="name">
                <figcaption className="mt-2 text-xs font-semibold text-dark">
                  {`— ${quote.name}`}
                </figcaption>
              </ZeroCmsEntryField>
            ) : null}
          </figure>
        </ZeroCmsEntry>
      ) : null}

      {sidebarCta ? (
        <Cta variant="sidebar" data={sidebarCta} />
      ) : (
        <div className="rounded-xl bg-dark p-6 text-center text-white shadow-lg">
          <p className="font-serif text-xl leading-tight text-white">
            Planning a similar project?
          </p>
          <p className="mt-1.5 text-sm text-subtle">
            Get a detailed quote with a free site visit.
          </p>
          <div className="mt-4 flex flex-col gap-2.5">
            <Link
              href="/contact"
              className="inline-flex h-11 w-full items-center justify-center rounded-full bg-gold px-5 text-sm font-semibold text-white transition hover:brightness-110"
            >
              Request a Site Visit
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
