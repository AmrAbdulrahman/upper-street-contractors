import type { CSSProperties } from "react";

// Fixed booking slots for the `timeWindow` field and for each Preferred date of
// an `availability` field (multi-select). En-dash by design.
export const TIME_WINDOWS = ["9am–1pm", "1pm–4pm", "4pm–8pm"] as const;

/**
 * The pill used for every multi-select choice in the wizard — a Time window on
 * a Preferred date, and the retired standalone `timeWindow` field.
 *
 * Shared because those two call sites carried the same class string character
 * for character, so a visual change to one that missed the other would leave
 * two identical-looking controls disagreeing about what "chosen" looks like.
 *
 * Selected is deliberately loud — solid gold, a halo ring, heavier type and a
 * tick. It used to be a 1px border swap, which on a page already full of gold
 * accents was barely a signal at all.
 */
export function optionChipClassName(on: boolean): string {
  return [
    "inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm transition-all",
    "focus:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2",
    on
      ? "border-gold bg-gold font-semibold text-white shadow-sm ring-2 ring-gold/30"
      : "border-border bg-white font-medium text-dark hover:border-gold/50 hover:bg-gold-light/40",
  ].join(" ");
}

/**
 * Weekdays the business never attends, as `Date.getDay()` numbers (0 = Sunday).
 *
 * The published hours are Mon–Fri 8am–6pm and Sat 9am–2pm (see
 * `components/layout/footer/footer-static.ts`), so Sunday is closed outright
 * while Saturday is a short working day. The calendar previously offered every
 * day of the week, which asked a visitor to nominate a Sunday nobody would ever
 * turn up on — the field's `allowWeekends` toggle could only refuse Saturday
 * and Sunday together, so switching it off lost a real working day to remove a
 * fake one.
 *
 * Hardcoded here, deliberately, only until the opening hours move into Settings
 * and both this and the footer read them from one place. It is a duplicate of a
 * fact, not a second definition of it.
 */
export const CLOSED_WEEKDAYS = [0] as const;

// Store a picked date as local YYYY-MM-DD (no UTC shift from toISOString()).
export const toISODate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;

// Parse a stored YYYY-MM-DD back to a local Date for the controlled picker.
export const fromISODate = (s: string): Date | undefined => {
  const [y, m, d] = s.split("-").map(Number);
  return y && m && d ? new Date(y, m - 1, d) : undefined;
};

// Human-readable date for the confirmation line + the emailed enquiry.
export const formatDateLong = (s: string): string => {
  const d = fromISODate(s);
  return d
    ? d.toLocaleDateString("en-GB", {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : s;
};

// Gold-tinted theme for the DayPicker calendar (CSS vars inherit into .rdp-root).
export const DAYPICKER_THEME = {
  "--rdp-accent-color": "var(--color-gold)",
  "--rdp-accent-background-color": "color-mix(in srgb, var(--color-gold) 14%, white)",
  "--rdp-today-color": "var(--color-gold-deep)",
} as CSSProperties;

/**
 * One Preferred date of an Availability answer: a day the visitor ticked, plus
 * the Time windows they chose on it. An empty `windows` is a real answer — it
 * means any time that day, not "unanswered".
 */
export type AvailabilityEntry = { date: string; windows: string[] };

/**
 * Fallbacks for the Availability calendar's four CMS config attributes, which
 * live on the Timing step (`form-question`) rather than on the calendar field —
 * see scripts/seed-timing-config-to-step.mjs. Mirrors the `default`s set by
 * scripts/seed-availability-schema.mjs — applied here too so the widget never
 * depends on read-time default projection (ADR 0011).
 *
 * `emergencyHorizonDays` is deliberately absent: 0 is its own off switch, so
 * `availability-field.tsx` falls back to it inline.
 */
export const AVAILABILITY_DEFAULTS = {
  /** 0 = unlimited. */
  maxDates: 5,
  /** Days from today: 0 = today, 1 = tomorrow. */
  earliestOffsetDays: 0,
  /** 0 = no ceiling. */
  horizonMonths: 6,
  allowWeekends: true,
} as const;

/** What a Preferred date with no Time windows reads as, in the UI and the email. */
export const ANY_TIME_LABEL = "Any time";

/**
 * The emailed value of an Availability answer: one line per Preferred date,
 * chronological. `/api/enquiry` takes `{label, value}` strings and the email
 * template turns `\n` into `<br>`, so no server change is needed for this.
 */
export const formatAvailability = (entries: AvailabilityEntry[]): string =>
  [...entries]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(
      (e) =>
        `${formatDateLong(e.date)} — ${
          e.windows.length ? e.windows.join(", ") : ANY_TIME_LABEL
        }`,
    )
    .join("\n");

/** ≥1 Preferred date, and ≥1 Time window somewhere across them. */
export const isAvailabilityComplete = (entries: AvailabilityEntry[]) =>
  entries.length > 0 && entries.some((e) => e.windows.length > 0);
