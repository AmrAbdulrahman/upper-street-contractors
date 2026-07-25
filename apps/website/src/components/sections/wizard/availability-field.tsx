"use client";

import type { ReactNode } from "react";
import { DayPicker, type Matcher } from "@daypicker/react";
import {
  ANY_TIME_LABEL,
  AVAILABILITY_DEFAULTS,
  DAYPICKER_THEME,
  TIME_WINDOWS,
  formatDateLong,
  fromISODate,
  isAvailabilityComplete,
  toISODate,
  type AvailabilityEntry,
} from "./helpers";

type AvailabilityFieldProps = {
  /** The shared label fragment the wizard builds for every field. */
  labelText: ReactNode;
  /** DOM id prefix, so the hint can be wired with aria-describedby. */
  id: string;
  /**
   * The CMS `form-field`. The four config attributes are optional because the
   * WizardSection fragment must select them (wizard.graphql) and the CMS may
   * still return null — `AVAILABILITY_DEFAULTS` fills the gaps.
   */
  field: {
    label?: string | null;
    required?: boolean | null;
    maxDates?: number | null;
    earliestOffsetDays?: number | null;
    horizonMonths?: number | null;
    allowWeekends?: boolean | null;
  };
  value: AvailabilityEntry[];
  onChange: (next: AvailabilityEntry[]) => void;
};

/**
 * The Availability field: a multi-date calendar, plus one row of Time windows
 * per Preferred date. Ticking no window on a date is a valid answer meaning any
 * time that day; picking no date at all is not (see the required hint).
 */
export function AvailabilityField({
  labelText,
  id,
  field,
  value,
  onChange,
}: AvailabilityFieldProps) {
  // `??` not `||` — 0 is meaningful for all three numbers.
  const maxDates = field.maxDates ?? AVAILABILITY_DEFAULTS.maxDates;
  const earliestOffsetDays =
    field.earliestOffsetDays ?? AVAILABILITY_DEFAULTS.earliestOffsetDays;
  const horizonMonths = field.horizonMonths ?? AVAILABILITY_DEFAULTS.horizonMonths;
  const allowWeekends = field.allowWeekends ?? AVAILABILITY_DEFAULTS.allowWeekends;

  const earliest = new Date();
  earliest.setHours(0, 0, 0, 0);
  earliest.setDate(earliest.getDate() + earliestOffsetDays);

  // Month-add, so a horizon from the 31st can land on the 1st/3rd of the target
  // month. Close enough for a "how far ahead" ceiling.
  let horizonEnd: Date | undefined;
  if (horizonMonths > 0) {
    horizonEnd = new Date(earliest);
    horizonEnd.setMonth(horizonEnd.getMonth() + horizonMonths);
  }

  const picked = new Set(value.map((e) => e.date));
  const capReached = maxDates > 0 && value.length >= maxDates;

  const disabled: Matcher[] = [
    { before: earliest },
    ...(horizonEnd ? [{ after: horizonEnd }] : []),
    ...(allowWeekends ? [] : [{ dayOfWeek: [0, 6] }]),
    // At the cap only the already-picked days stay clickable. We enforce the cap
    // ourselves rather than with DayPicker's `max`, which does not refuse the
    // extra day — it hands back a fresh single-day selection, silently binning
    // every day already picked along with its Time windows.
    ...(capReached ? [(day: Date) => !picked.has(toISODate(day))] : []),
  ];

  const selected = value
    .map((e) => fromISODate(e.date))
    .filter(Boolean) as Date[];

  /** Keep the windows already chosen on days that survive the new selection. */
  const selectDays = (days: Date[] | undefined) => {
    const iso = (days ?? []).map(toISODate);
    // Second line of defence for the cap (keyboard, and the reset described
    // above): refuse anything that adds a day we don't already hold.
    if (capReached && iso.some((date) => !picked.has(date))) return;
    const kept = new Map(value.map((e) => [e.date, e]));
    onChange(
      iso
        .map((date) => kept.get(date) ?? { date, windows: [] })
        // ISO YYYY-MM-DD sorts lexicographically, so rows stay chronological
        // whatever order the visitor clicked in.
        .sort((a, b) => a.date.localeCompare(b.date)),
    );
  };

  const toggleWindow = (date: string, w: string) =>
    onChange(
      value.map((e) => {
        if (e.date !== date) return e;
        const next = e.windows.includes(w)
          ? e.windows.filter((x) => x !== w)
          : [...e.windows, w];
        // Persist in canonical slot order regardless of click order.
        return { ...e, windows: TIME_WINDOWS.filter((x) => next.includes(x)) };
      }),
    );

  const removeDate = (date: string) =>
    onChange(value.filter((e) => e.date !== date));

  const hintId = `${id}-hint`;
  const unmet = Boolean(field.required) && !isAvailabilityComplete(value);

  return (
    <fieldset className="flex flex-col gap-1.5" aria-describedby={hintId}>
      <legend className="mb-1.5">{labelText}</legend>

      {/* The calendar is a fixed-width grid — let it scroll rather than push the
          page sideways on a narrow phone. */}
      <div className="-mx-1 overflow-x-auto px-1">
        <div className="w-fit rounded-lg border border-border bg-white p-2">
          <DayPicker
            mode="multiple"
            selected={selected}
            onSelect={selectDays}
            disabled={disabled}
            startMonth={earliest}
            endMonth={horizonEnd}
            style={DAYPICKER_THEME}
          />
        </div>
      </div>

      {/* One row per Preferred date. Announced, because rows appear and vanish
          as days are ticked in the calendar above. */}
      <div aria-live="polite" className="flex flex-col gap-2">
        {value.map((entry) => {
          const when = formatDateLong(entry.date);
          return (
            <div
              key={entry.date}
              className="rounded-lg border border-border-light bg-white p-3"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-sm font-medium text-dark">
                  Preferred time of day{" "}
                  <span className="font-normal text-muted">({when})</span>
                </span>
                <button
                  type="button"
                  onClick={() => removeDate(entry.date)}
                  aria-label={`Remove ${when}`}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-muted transition-colors hover:bg-border-light hover:text-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
                >
                  <span aria-hidden="true">✕</span>
                </button>
              </div>

              <div
                role="group"
                aria-label={`Preferred time of day on ${when}`}
                className="mt-1 flex flex-wrap gap-2"
              >
                {TIME_WINDOWS.map((w) => {
                  const on = entry.windows.includes(w);
                  return (
                    <button
                      type="button"
                      key={w}
                      aria-pressed={on}
                      onClick={() => toggleWindow(entry.date, w)}
                      className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-gold ${on ? "border-gold bg-gold text-white" : "border-border bg-white text-dark hover:border-gold/40"}`}
                    >
                      {w}
                    </button>
                  );
                })}
              </div>

              {entry.windows.length ? null : (
                <span className="mt-2 block text-xs text-muted">
                  {`${ANY_TIME_LABEL} — we’ll work around you on this day.`}
                </span>
              )}
            </div>
          );
        })}
      </div>

      <span id={hintId} className="text-xs text-muted">
        Pick any days that suit you, then tick the times that work on each. Leave
        a day&rsquo;s times blank and we&rsquo;ll read it as {ANY_TIME_LABEL.toLowerCase()}.
        {maxDates > 0 ? (
          <>
            {" "}
            <span className={capReached ? "text-dark" : undefined}>
              {value.length} of {maxDates} days chosen.
              {capReached ? " Remove a day to pick another." : ""}
            </span>
          </>
        ) : null}
        {unmet ? (
          <>
            {" "}
            <span className="text-dark">
              Pick at least one day, and a time on at least one of them.
            </span>
          </>
        ) : null}
      </span>
    </fieldset>
  );
}
