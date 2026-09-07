import type { SiteMetaConfigFragment } from "@/generated/graphql";
import type { IconKey } from "@/components/ui/icon";

export type SocialProfile = {
  id: string;
  /** The platform's own name, used as the link's accessible name. */
  name: string;
  url: string;
  icon: IconKey;
};

/**
 * Which Social profiles the footer draws an icon for, and which icon.
 *
 * Keyed off the `social-link`'s Platform, which is a `lookup` precisely so this
 * can be a match rather than a guess — as free text, "X", "Twitter" and "x.com"
 * all mean one row and none of them would key an icon reliably.
 *
 * Two stored profiles are deliberately absent. **WhatsApp** is here as the
 * site's one messaging destination (`resolveWhatsAppUrl` reads it), and it has
 * the pinned Quick Contact tab on every page — a sixth icon in the footer is
 * the duplication that was just removed everywhere else. **Google Maps** is a
 * review destination, not a profile to follow; it belongs in the structured
 * data's `sameAs` (where it still is) and beside the Trustpilot mark, not in a
 * row captioned "Follow us".
 */
const ICON_BY_PLATFORM: Record<string, IconKey> = {
  facebook: "facebook",
  instagram: "instagram",
  linkedin: "linkedin",
  tiktok: "tiktok",
  x: "x",
};

export function resolveSocialProfiles(
  config: SiteMetaConfigFragment | null,
): SocialProfile[] {
  const links = config?.socialLinks ?? [];

  return links.flatMap((link) => {
    const name = link?.socialNetworkName?.trim();
    const url = link?.url?.trim();
    if (!name || !url) return [];

    const icon = ICON_BY_PLATFORM[name.toLowerCase()];
    if (!icon) return [];

    // Upgraded, never rewritten. The same URLs are emitted as the business's
    // structured-data profile list, where `http://` is an insecure claim as
    // well as a mixed-content link.
    return [{ id: link.id, name, url: url.replace(/^http:\/\//i, "https://"), icon }];
  });
}
