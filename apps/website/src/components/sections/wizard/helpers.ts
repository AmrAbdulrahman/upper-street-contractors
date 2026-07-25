import type { CSSProperties } from "react";

// Fixed booking slots for the `timeWindow` field and for each Preferred date of
// an `availability` field (multi-select). En-dash by design.
export const TIME_WINDOWS = ["9am–1pm", "1pm–4pm", "4pm–8pm"] as const;

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
 * Fallbacks for the Availability field's four CMS config attributes. Mirrors the
 * `default`s set by scripts/seed-availability-schema.mjs — applied here too so
 * the widget never depends on read-time default projection (ADR 0011).
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
