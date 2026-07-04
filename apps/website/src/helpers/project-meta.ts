/**
 * Project meta helpers: a project's duration derived from its begin/end dates,
 * and the meta-chip list (location, duration, value) shown below a project image.
 * Kept framework-agnostic (plain fields in, plain data out) so cards, the detail
 * page and the similarity ranking can all reuse them.
 */

/** Whole days between two ISO dates, or null when either is missing/invalid. */
export function durationDays(
  begin?: string | null,
  end?: string | null,
): number | null {
  if (!begin || !end) return null;
  const b = Date.parse(begin);
  const e = Date.parse(end);
  if (Number.isNaN(b) || Number.isNaN(e) || e < b) return null;
  return Math.round((e - b) / 86_400_000);
}

/** Human-readable project duration (e.g. "3 weeks", "4 months"), or null if unknown. */
export function getDuration(
  begin?: string | null,
  end?: string | null,
): string | null {
  const days = durationDays(begin, end);
  if (days == null) return null;
  if (days < 7) return `${days} day${days === 1 ? "" : "s"}`;
  if (days < 84) {
    const weeks = Math.round(days / 7);
    return `${weeks} week${weeks === 1 ? "" : "s"}`;
  }
  const months = Math.round(days / 30.44);
  if (months < 12) return `${months} month${months === 1 ? "" : "s"}`;
  const years = Math.floor(months / 12);
  const rem = months % 12;
  return rem ? `${years} yr ${rem} mo` : `${years} year${years === 1 ? "" : "s"}`;
}

export type ProjectMetaSource = {
  location?: string | null;
  beginDate?: string | null;
  endDate?: string | null;
  projectValue?: string | null;
};

export type ProjectMetaChip = { key: string; text: string };

/** The meta chips shown for a project: location, duration (derived), value. */
export function getProjectMetaChips(p: ProjectMetaSource): ProjectMetaChip[] {
  const chips: ProjectMetaChip[] = [];
  const location = p.location?.trim();
  if (location) chips.push({ key: "location", text: `📍 ${location}` });
  const duration = getDuration(p.beginDate, p.endDate);
  if (duration) chips.push({ key: "duration", text: `⏱ ${duration}` });
  const value = p.projectValue?.trim();
  if (value) chips.push({ key: "value", text: value });
  return chips;
}
