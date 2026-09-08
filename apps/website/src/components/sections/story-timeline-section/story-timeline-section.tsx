"use client";

import { useCallback, useState } from "react";
import {
  AddZeroCmsEntry,
  ZeroCmsEntry,
  ZeroCmsEntryField,
} from "@usc/zero-cms-widget";
import { CmsImage } from "@/components/ui/cms-image";
import { RichTextViewer } from "@/components/ui/rich-text-viewer";
import { useTabListKeys } from "@/helpers/use-tab-list-keys";
import type {
  MilestoneFragment,
  StoryTimelineSectionFragment,
} from "@/generated/graphql";

type StoryTimelineSectionProps = {
  data: StoryTimelineSectionFragment;
};

const SWIPE_THRESHOLD_PX = 48;

/**
 * The prev/next mark. Inlined rather than routed through `<Icon>`, whose codes
 * are the closed set an editor can pick from in the CMS — a control that is
 * never authored does not belong in that vocabulary.
 */
function Chevron({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
    </svg>
  );
}

/**
 * The Story Timeline — company history as a full-bleed photograph over a year
 * rail, with the copy for the selected year beneath it.
 *
 * Not the Project Timeline (`project-timeline-section`), which is the per-job
 * delivery stepper and holds Timeline Steps. This one holds Milestones.
 *
 * Interaction is the WAI-ARIA tabs pattern — one of N mutually exclusive
 * panels, so `role="tablist"` rather than the `aria-pressed` filter buttons the
 * projects and blog indexes use (ADR 0024). Every milestone's copy is in the
 * DOM at all times, inactive panels carrying `hidden`, so the whole history is
 * crawlable from one page load.
 */
export function StoryTimelineSection({ data }: StoryTimelineSectionProps) {
  const { overline, title } = data;
  const milestones = (data.milestones ?? []).filter(
    (m): m is MilestoneFragment => Boolean(m)
  );

  const [active, setActive] = useState(0);
  // Only photos the visitor has actually reached get mounted. All six stacked
  // at once would sit inside the viewport together, which defeats lazy loading
  // and puts six full-bleed images on the critical path.
  const [visited, setVisited] = useState<ReadonlySet<number>>(
    () => new Set([0])
  );

  const select = useCallback((index: number) => {
    setActive(index);
    setVisited((seen) => (seen.has(index) ? seen : new Set(seen).add(index)));
  }, []);

  // No wrapping: the rail is chronological, and → off the last year landing
  // back on the first would also disagree with the arrows, which stop.
  const { setRef, onKeyDown } = useTabListKeys(
    milestones.length,
    active,
    select,
    { wrap: false }
  );

  const atStart = active === 0;
  const atEnd = active === milestones.length - 1;

  const [swipeStartX, setSwipeStartX] = useState<number | null>(null);
  const onPointerUp = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (swipeStartX === null) return;
      const delta = event.clientX - swipeStartX;
      setSwipeStartX(null);
      if (Math.abs(delta) < SWIPE_THRESHOLD_PX) return;
      const next = delta < 0 ? active + 1 : active - 1;
      if (next >= 0 && next < milestones.length) select(next);
    },
    [active, milestones.length, select, swipeStartX]
  );

  if (milestones.length === 0) return null;

  const uid = `story-timeline-${data.id}`;
  const tabId = (index: number) => `${uid}-year-${index}`;
  const panelId = (index: number) => `${uid}-panel-${index}`;

  return (
    <ZeroCmsEntry entry={data}>
      <section className="bg-surface">
        <div className="mx-auto max-w-container px-6 pt-[88px]">
          {overline ? (
            <ZeroCmsEntryField field="overline">
              <p className="text-[11px] font-bold tracking-[0.12em] text-gold-deep uppercase">
                {overline}
              </p>
            </ZeroCmsEntryField>
          ) : null}

          {title ? (
            <ZeroCmsEntryField field="title">
              <h2 className="mt-2.5 max-w-3xl font-serif text-[clamp(26px,3.5vw,42px)] leading-tight text-dark">
                {title}
              </h2>
            </ZeroCmsEntryField>
          ) : null}
        </div>

        {/* Full-bleed: this div is a direct child of <section>, outside the
            max-w-container wrapper, so it needs no negative-margin trick. */}
        <div
          className="relative mt-10 h-[68vh] max-h-[720px] min-h-[380px] w-full overflow-hidden bg-dark"
          onPointerDown={(event) => setSwipeStartX(event.clientX)}
          onPointerUp={onPointerUp}
          onPointerCancel={() => setSwipeStartX(null)}
        >
          {milestones.map((milestone, index) =>
            visited.has(index) ? (
              <div
                key={milestone.id}
                aria-hidden={index !== active}
                className={`absolute inset-0 motion-safe:transition-opacity motion-safe:duration-300 ${
                  index === active ? "opacity-100" : "opacity-0"
                }`}
              >
                <CmsImage
                  data={milestone.image}
                  fallbackAlt={`${milestone.dateLabel} — ${milestone.heading ?? "milestone"}`}
                  placeholderLabel="Milestone image placeholder"
                  sizes="100vw"
                  priority={index === 0}
                  className="h-full w-full object-cover"
                />
              </div>
            ) : null
          )}

          {/* Prev/next sit over the photograph, the place a visitor looks for
              them. They are NOT inside the tab list below — a tablist's
              children have to be tabs, and these select a tab rather than being
              one.

              `aria-disabled` rather than `disabled` at the ends: a disabled
              button drops out of the tab order, so a keyboard user who reaches
              the last year loses focus to the document body mid-interaction.
              This stays focusable and does nothing.

              A pointerdown here also reaches the container's swipe handler, and
              harmlessly: a click moves the pointer by ~0px, well under the
              swipe threshold. */}
          <button
            type="button"
            aria-label="Previous milestone"
            aria-disabled={atStart}
            onClick={() => {
              if (!atStart) select(active - 1);
            }}
            className={`absolute top-1/2 left-3 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-dark shadow-lg transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-deep sm:left-6 ${
              atStart ? "cursor-default opacity-40" : "cursor-pointer hover:bg-white"
            }`}
          >
            <Chevron className="h-5 w-5 rotate-90" />
          </button>

          <button
            type="button"
            aria-label="Next milestone"
            aria-disabled={atEnd}
            onClick={() => {
              if (!atEnd) select(active + 1);
            }}
            className={`absolute top-1/2 right-3 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-dark shadow-lg transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-deep sm:right-6 ${
              atEnd ? "cursor-default opacity-40" : "cursor-pointer hover:bg-white"
            }`}
          >
            <Chevron className="h-5 w-5 -rotate-90" />
          </button>
        </div>

        <div className="mx-auto max-w-container px-6">
          <div className="relative">
            {/* The connecting line is a SIBLING of the tab list. Anything
                decorative placed among the tabs would offset the index the rail
                and the panels agree on. */}
            <span
              aria-hidden
              className="pointer-events-none absolute top-4 right-8 left-8 hidden h-px bg-border sm:block"
            />

            <div
              role="tablist"
              aria-label="Company milestones"
              aria-orientation="horizontal"
              onKeyDown={onKeyDown}
              className="relative flex snap-x snap-mandatory gap-1 overflow-x-auto sm:justify-between sm:gap-2 sm:overflow-x-visible"
            >
              {milestones.map((milestone, index) => {
                const isActive = index === active;
                return (
                  <button
                    key={milestone.id}
                    ref={setRef(index)}
                    type="button"
                    role="tab"
                    id={tabId(index)}
                    aria-selected={isActive}
                    aria-controls={panelId(index)}
                    tabIndex={isActive ? 0 : -1}
                    onClick={() => select(index)}
                    className="flex shrink-0 snap-start cursor-pointer flex-col items-center gap-2 px-4 py-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-deep"
                  >
                    <span
                      aria-hidden
                      className={`h-4 w-4 rounded-full ring-4 ring-surface transition-colors ${
                        isActive
                          ? "bg-gold-mid"
                          : "bg-border-light group-hover:bg-gold-light"
                      }`}
                    />
                    <span
                      className={`text-[13px] transition-colors ${
                        isActive
                          ? "font-bold text-dark"
                          : "font-semibold text-muted"
                      }`}
                    >
                      {milestone.dateLabel}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* An arrow click or a swipe changes selection without moving focus,
              so nothing would be announced. The rail's own aria-selected only
              helps when focus is already inside it. Polite, and empty of new
              content on mount, so it stays quiet until someone acts. */}
          <p aria-live="polite" className="sr-only">
            {`${milestones[active]?.dateLabel ?? ""}${
              milestones[active]?.heading ? `, ${milestones[active].heading}` : ""
            }`}
          </p>

          <div className="pt-10 pb-[88px]">
            {milestones.map((milestone, index) => (
              <div
                key={milestone.id}
                role="tabpanel"
                id={panelId(index)}
                aria-labelledby={tabId(index)}
                hidden={index !== active}
                tabIndex={0}
                className="focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold-deep"
              >
                <ZeroCmsEntry entry={milestone}>
                  <div className="grid gap-4 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] lg:gap-14">
                    {milestone.heading ? (
                      <ZeroCmsEntryField field="heading">
                        <h3 className="font-serif text-[clamp(22px,2.4vw,30px)] leading-tight text-dark">
                          {milestone.heading}
                        </h3>
                      </ZeroCmsEntryField>
                    ) : null}

                    {milestone.body ? (
                      <ZeroCmsEntryField field="body">
                        <RichTextViewer
                          content={milestone.body}
                          variant="who-we-are-body"
                          className="flex flex-col gap-5"
                        />
                      </ZeroCmsEntryField>
                    ) : null}
                  </div>
                </ZeroCmsEntry>
              </div>
            ))}

            <AddZeroCmsEntry field="milestones" label="+ Add milestone" />
          </div>
        </div>
      </section>
    </ZeroCmsEntry>
  );
}
