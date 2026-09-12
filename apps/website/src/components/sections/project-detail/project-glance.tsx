import { Cta } from "@/components/ui/cta";
import type { CtaFragment, ProjectDetailFragment } from "@/generated/graphql";
import { durationDays } from "@/helpers/project-meta";
import { ZeroCmsEntryField } from "@usc/zero-cms-widget";
import Link from "next/link";

const GUARANTEE = "12-month workmanship";

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
      {/* `text-white/75`, not `text-subtle`: the token is the right one for a
          dark ground, but these labels are 11px on a card whose `bg-white/[0.06]`
          wash lifts the navy to #182534, and #7a8798 on that is 4.24:1 — under
          the 4.5:1 small text needs. A fixed white alpha also cannot be pushed
          back under the bar by a Theme tab override. */}
      <p className="mt-1.5 text-[11px] font-semibold tracking-wide text-white/75 uppercase">
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
  /**
   * Deliverables on this Project, counted by the route off its own What We
   * Delivered section. It used to read `project.deliverables`, which is a
   * section's field now — and a section cannot be read from here.
   */
  scopeCount?: number;
  sidebarCta?: CtaFragment | null;
};

/**
 * Project at a glance — the facts a reader skims before the story: duration,
 * value, scope size, rating, plus type/location/occupancy/guarantee.
 *
 * A band under the hero rather than the sticky aside it was. The aside existed
 * beside a two-column body that no longer exists: a Project's content is a list
 * of full-width sections now (ADR 0022), and a 360px rail beside them would
 * squeeze every one of them into a column they were never designed for.
 *
 * Derived, not authored — every value here is a Project field or computed from
 * one — which is why it stays route-rendered rather than becoming a section an
 * editor could delete and leave the page contradicting its own card.
 */
export function ProjectGlance({ project, scopeCount, sidebarCta }: ProjectGlanceProps) {
  const dur = durationStat(project.beginDate, project.endDate);
  const rating = project.clientRating;
  const type = project.subCategory ?? project.category ?? null;
  const occupancy = project.occupancy ?? "Occupied throughout";

  return (
    <section className="bg-dark text-white">
      <div className="mx-auto max-w-container px-6 pt-8 pb-[72px]">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-10">
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6">
            <h2 className="text-[11px] font-semibold tracking-[0.12em] text-gold-mid uppercase">
              Project at a glance
            </h2>

            <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
              {dur ? <Stat value={dur.value} unit={dur.unit} label="Duration" /> : null}
              {project.projectValue ? (
                <Stat value={project.projectValue} label="Project value" field="projectValue" />
              ) : null}
              {scopeCount ? <Stat value={String(scopeCount)} label="Scope items" /> : null}
              {rating != null ? (
                <Stat value={`★${rating}`} label="Client rating" field="clientRating" />
              ) : null}
            </div>

            <div className="mt-5 grid gap-1.5 border-t border-white/10 pt-4 sm:grid-cols-2">
              {type ? <Detail label="Type" value={type} field="subCategory" /> : null}
              {project.location ? (
                <Detail label="Location" value={project.location} field="location" />
              ) : null}
              <Detail label="Occupancy" value={occupancy} field="occupancy" />
              <Detail label="Guarantee" value={GUARANTEE} />
            </div>
          </div>

          {sidebarCta ? (
            <Cta variant="sidebar" data={sidebarCta} />
          ) : (
            <div className="flex flex-col justify-center rounded-xl border border-white/10 bg-white/[0.03] p-6 text-center">
              <p className="font-serif text-xl leading-tight text-white">
                Planning a similar project?
              </p>
              <p className="mt-1.5 text-sm text-subtle">
                Get a detailed quote with a free site visit.
              </p>
              <div className="mt-4">
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
      </div>
    </section>
  );
}
