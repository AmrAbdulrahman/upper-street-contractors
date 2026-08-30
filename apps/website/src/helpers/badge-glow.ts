/**
 * Shared resolver for the Badge glow on a Footer accreditation row badge.
 *
 * Three settings, each per-badge with a Global Settings fallback: colour,
 * radius and intensity. Colour is per-badge because each mark is a different
 * organisation's palette — one site-wide gold behind Gas Safe's yellow and
 * NICEIC's red fought both. Radius and intensity follow the same rule for the
 * same reason: a dense logo needs less bloom than a thin one to read.
 *
 * The bounds mirror the schema (see scripts/seed-glow-radius.mjs), but read-time
 * projection still hands us `null` on entries saved before the fields existed,
 * so every value is clamped here rather than trusted.
 */

/** Bounds mirroring the `glowRadius` field's schema `min`/`max`. */
const MIN_RADIUS = 0;
const MAX_RADIUS = 40;

/** Bounds mirroring the `glowIntensity` field's schema `min`/`max`. */
const MIN_INTENSITY = 0;
const MAX_INTENSITY = 100;

/** Blur in px when nothing has been set. Was a hardcoded 10, which read as a smudge. */
export const DEFAULT_GLOW_RADIUS = 6;

/** Percentage of the glow colour that survives when nothing has been set. */
export const DEFAULT_GLOW_INTENSITY = 70;

function clamp(
  value: number | null | undefined,
  fallback: number,
  min: number,
  max: number,
): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(Math.max(Math.round(value), min), max);
}

export type BadgeGlowInput = {
  /** The badge's own settings. Any of them wins over the row's. */
  own: {
    color?: string | null;
    radius?: number | null;
    intensity?: number | null;
  };
  /** The row's fallbacks, from Global Settings. */
  fallback?: {
    color?: string | null;
    radius?: number | null;
    intensity?: number | null;
  } | null;
};

/**
 * The `filter` value for a badge, or `undefined` for no glow at all.
 *
 * Two stacked shadows: a tight one for the edge and a wider, softer one for the
 * bloom. One alone reads as either a hard outline or a smudge.
 *
 * A radius of 0 returns nothing — an editor typing zero means "no glow on this
 * badge", and a 0px blur would still paint a hard-edged copy of the logo behind
 * itself. `color-mix` toward `transparent` is what makes intensity a real dial
 * rather than a second colour picker: the badge keeps its own hue and only the
 * amount of it changes.
 */
export function resolveBadgeGlow({ own, fallback }: BadgeGlowInput): string | undefined {
  const color = own.color?.trim() || fallback?.color?.trim() || null;
  if (!color) return undefined;

  const radius = clamp(
    own.radius ?? fallback?.radius,
    DEFAULT_GLOW_RADIUS,
    MIN_RADIUS,
    MAX_RADIUS,
  );
  if (radius === 0) return undefined;

  const intensity = clamp(
    own.intensity ?? fallback?.intensity,
    DEFAULT_GLOW_INTENSITY,
    MIN_INTENSITY,
    MAX_INTENSITY,
  );
  if (intensity === 0) return undefined;

  const tinted =
    intensity >= 100
      ? color
      : `color-mix(in srgb, ${color} ${intensity}%, transparent)`;

  // The tight shadow tracks the bloom so the pair stays in proportion at any
  // radius — a fixed 2px edge disappears under a 40px bloom.
  const edge = Math.max(1, Math.round(radius / 5));

  return `drop-shadow(0 0 ${edge}px ${tinted}) drop-shadow(0 0 ${radius}px ${tinted})`;
}
