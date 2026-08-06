/**
 * Shared resolver for the CMS-editable `logoSize` field on the logo-strip
 * sections (Accreditations, Clients Carousel).
 *
 * The number is a rendered HEIGHT in px — width follows the image's aspect
 * ratio, which is what makes a row of mixed-shape logos look even. The schema
 * bounds it to 16-200 (see scripts/seed-logo-size-schema.mjs), but read-time
 * projection can still hand us `null` on an entry saved before the field
 * existed, so every call site needs a fallback.
 */

/** Bounds mirroring the `logoSize` field's schema `min`/`max`. */
const MIN_LOGO_HEIGHT = 16;
const MAX_LOGO_HEIGHT = 200;

export function resolveLogoHeight(
  size: number | null | undefined,
  fallback: number,
): number {
  if (typeof size !== "number" || !Number.isFinite(size)) return fallback;

  return Math.min(Math.max(Math.round(size), MIN_LOGO_HEIGHT), MAX_LOGO_HEIGHT);
}
