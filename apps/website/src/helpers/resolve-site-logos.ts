import type { SiteMetaConfigFragment } from "@/generated/graphql";
import { resolveMediaUrl } from "@/helpers/media-url";

export type SiteLogos = {
  /** Navy artwork, for light backgrounds. */
  dark?: string | null;
  /** White artwork, for dark backgrounds. */
  light?: string | null;
};

/**
 * The brand artwork an editor has uploaded in Site settings, if any.
 *
 * Two slots, one per tone. It was four — a crest and a wordmark for each —
 * back when `<SiteBanner>` drew the lockup as two images; collapsing the pair
 * into the single `banner-*.svg` it was cropped from collapsed the settings
 * with it. Each tone is independently optional and `<SiteBanner>` falls back
 * per slot, so a half-filled pair is not a broken header. `resolveMediaUrl` is
 * what turns a stored media reference into something `next/image` can load.
 */
export function resolveSiteLogos(
  config: SiteMetaConfigFragment | null | undefined,
): SiteLogos | null {
  if (!config) return null;
  return {
    dark: resolveMediaUrl(config.logoDark?.url),
    light: resolveMediaUrl(config.logoLight?.url),
  };
}
