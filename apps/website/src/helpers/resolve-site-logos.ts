import type { SiteMetaConfigFragment } from "@/generated/graphql";
import { resolveMediaUrl } from "@/helpers/media-url";

export type SiteLogos = {
  crestDark?: string | null;
  crestLight?: string | null;
  wordmarkDark?: string | null;
  wordmarkLight?: string | null;
};

/**
 * The brand artwork an editor has uploaded in Site settings, if any.
 *
 * Every field is independently optional and `<SiteBanner>` falls back per slot,
 * so a half-filled set is not a broken header — it is the built-in artwork for
 * whichever pieces were left alone. `resolveMediaUrl` is what turns a stored
 * media reference into something `next/image` can load.
 */
export function resolveSiteLogos(
  config: SiteMetaConfigFragment | null | undefined,
): SiteLogos | null {
  if (!config) return null;
  return {
    crestDark: resolveMediaUrl(config.logoCrestDark?.url),
    crestLight: resolveMediaUrl(config.logoCrestLight?.url),
    wordmarkDark: resolveMediaUrl(config.logoWordmarkDark?.url),
    wordmarkLight: resolveMediaUrl(config.logoWordmarkLight?.url),
  };
}
