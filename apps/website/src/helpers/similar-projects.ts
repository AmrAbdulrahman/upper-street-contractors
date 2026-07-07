/**
 * "Similar work" ranking. Editor-pinned `similarWork` entries come first, then the
 * closest remaining projects ranked by category → location → duration. Excludes the
 * current project. Pure and structurally typed so it works on any project-card-shaped
 * fragment.
 */

import { durationDays } from "./project-meta";

type SimilarProject = {
  id: string;
  category?: string | null;
  location?: string | null;
  beginDate?: string | null;
  endDate?: string | null;
};

/** The postcode district / area after the last comma, e.g. "Highbury, N5" → "n5". */
function district(location?: string | null): string | null {
  if (!location) return null;
  const parts = location.split(",");
  return parts[parts.length - 1]?.trim().toLowerCase() || null;
}

function score(a: SimilarProject, b: SimilarProject): number {
  let s = 0;
  if (a.category && b.category && a.category === b.category) s += 100;
  const la = a.location?.trim().toLowerCase();
  const lb = b.location?.trim().toLowerCase();
  if (la && lb) {
    if (la === lb) s += 40;
    else {
      const da = district(a.location);
      if (da && da === district(b.location)) s += 20;
    }
  }
  const dda = durationDays(a.beginDate, a.endDate);
  const ddb = durationDays(b.beginDate, b.endDate);
  if (dda != null && ddb != null) {
    s += Math.max(0, 30 - Math.round(Math.abs(dda - ddb) / 7));
  }
  return s;
}

export function getSimilarProjects<T extends SimilarProject>(
  current: SimilarProject & { similarWork?: readonly (T | null)[] | null },
  all: readonly T[],
  limit = 3,
): T[] {
  const chosen = new Map<string, T>();

  // Editor-pinned first (in author order).
  for (const pin of current.similarWork ?? []) {
    if (pin && pin.id !== current.id) chosen.set(pin.id, pin);
  }

  // Auto-fill the remaining slots by similarity.
  if (chosen.size < limit) {
    const ranked = all
      .filter((p) => p.id !== current.id && !chosen.has(p.id))
      .map((p) => ({ p, s: score(current, p) }))
      .sort((x, y) => y.s - x.s);
    for (const { p } of ranked) {
      if (chosen.size >= limit) break;
      chosen.set(p.id, p);
    }
  }

  return Array.from(chosen.values()).slice(0, limit);
}
