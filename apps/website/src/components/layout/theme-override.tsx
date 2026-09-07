import type { SiteMetaConfigFragment } from "@/generated/graphql";

/**
 * Every colour token an editor can override, paired with the CSS custom
 * property it sets. The field `__name` mirrors the property on purpose, so this
 * table is the only place the two are tied together.
 *
 * Colours only. Radii, shadows, fonts and the container width stay in
 * `globals.css`: some of them are compiled into Tailwind utility class names at
 * build time, which a runtime `:root` override cannot reach, and all of them
 * are the tokens where a bad value breaks the layout rather than merely looking
 * wrong.
 */
const THEME_TOKENS = [
  ["themeSurface", "--color-surface"],
  ["themeWhite", "--color-white"],
  ["themeDark", "--color-dark"],
  ["themeDark2", "--color-dark-2"],
  ["themeGold", "--color-gold"],
  ["themeGoldLight", "--color-gold-light"],
  ["themeGoldMid", "--color-gold-mid"],
  ["themeGoldDeep", "--color-gold-deep"],
  ["themeForeground", "--color-foreground"],
  ["themeMuted", "--color-muted"],
  ["themeSubtle", "--color-subtle"],
  ["themeBorder", "--color-border"],
  ["themeBorderLight", "--color-border-light"],
  ["themeWhatsapp", "--color-whatsapp"],
] as const satisfies ReadonlyArray<readonly [keyof SiteMetaConfigFragment, string]>;

/**
 * A hex colour, and nothing else.
 *
 * The `color` field kind validates this on every write, so a bad value should
 * never be stored — but this text is being interpolated into a `<style>` tag,
 * and the check that makes that safe has to be at the point of injection rather
 * than somewhere upstream that a future write path might not go through.
 */
const HEX = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

/**
 * Overrides the site's colour tokens from Global Settings' Theme tab.
 *
 * Only tokens that actually carry a value are emitted, which is what makes
 * "Reset theme" a matter of clearing fields: with nothing written, this renders
 * nothing at all and `globals.css`'s own `@theme` values stand. Nothing stores a
 * second copy of the defaults, so they cannot go stale.
 *
 * Emitted where `siteMetaConfig` is already awaited rather than in the root
 * layout, which does not read the CMS — `getSiteMetaConfig` is `cache()`d, so
 * this costs no extra round trip.
 */
export function ThemeOverride({
  config,
}: {
  config: SiteMetaConfigFragment | null;
}) {
  if (!config) return null;

  const declarations = THEME_TOKENS.flatMap(([field, cssVar]) => {
    const value = config[field];
    if (typeof value !== "string") return [];
    const trimmed = value.trim();
    if (!HEX.test(trimmed)) return [];
    return [`${cssVar}:${trimmed}`];
  });

  if (declarations.length === 0) return null;

  return (
    <style
      // Every value has been through the hex test above, so there is no `<`,
      // no quote and no semicolon-plus-anything in what follows.
      dangerouslySetInnerHTML={{ __html: `:root{${declarations.join(";")}}` }}
    />
  );
}
