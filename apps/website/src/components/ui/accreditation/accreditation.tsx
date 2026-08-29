import { ZeroCmsEntryField } from "@usc/zero-cms-widget";
import { CmsImage } from "@/components/ui/cms-image";
import { resolveLogoHeight } from "@/helpers";
import { AccreditationFragment } from "@/generated/graphql";

/** Height used when the parent section has no CMS `logoSize` (was `h-14`). */
export const ACCREDITATION_LOGO_HEIGHT = 56;

/**
 * Ratios preserved from the previous fixed classes, so changing the CMS size
 * scales the whole tile the way the hand-tuned version looked:
 *   tile height  `h-20` (80) = image `h-14` (56) + 24px of breathing room
 *   image width  `max-w-[180px]` at a 56px height = 3.21x
 */
const TILE_PADDING_Y = 24;
const LOGO_MAX_ASPECT = 180 / 56;

/**
 * Motion, not revelation. Every badge is full colour at rest — a mark you have
 * to hover to read properly is one most visitors never read, and a touch screen
 * has no hover to give. All this adds is a lift.
 *
 * It lives on the component rather than on each caller's wrapper so the
 * Accreditations section and the Footer accreditation row cannot drift apart.
 */
const HOVER_CLASS =
  "transition-transform duration-250 ease-out hover:-translate-y-0.5 hover:scale-[1.04] motion-reduce:transition-none motion-reduce:hover:translate-y-0 motion-reduce:hover:scale-100";

export type AccreditationProps = {
  data: AccreditationFragment;
  /** Rendered logo height in px — comes from the section's CMS `logoSize`. */
  height?: number;
  /**
   * Drop the white tile behind the logo. For dark surfaces (the Footer
   * accreditation row), where a white card is a bright rectangle punched into
   * the footer rather than a badge sitting on it.
   */
  bare?: boolean;
  /**
   * Fallback glow colour, used only when the badge has no `glowColor` of its
   * own. Each badge is a different organisation's mark with its own palette, so
   * the colour belongs to the entry; this is what a newly added badge gets
   * until someone picks one.
   *
   * `drop-shadow` follows the image's **alpha channel**, so the glow traces the
   * logo's actual silhouette rather than boxing it — which is the whole point
   * on a transparent badge, and why this is not a `box-shadow`.
   */
  glowColor?: string | null;
};

export function Accreditation({
  data,
  height,
  bare = false,
  glowColor,
}: AccreditationProps) {
  const { accreditationTitle, image } = data;
  const logoHeight = resolveLogoHeight(height, ACCREDITATION_LOGO_HEIGHT);
  const maxWidth = Math.round(logoHeight * LOGO_MAX_ASPECT);

  // The badge's own colour wins; the caller's is the fallback.
  const resolvedGlow = data.glowColor?.trim() || glowColor?.trim() || null;

  // Two stacked shadows: a tight one for the edge and a wider, softer one for
  // the bloom. One alone reads as either a hard outline or a smudge.
  const glow = resolvedGlow
    ? `drop-shadow(0 0 2px ${resolvedGlow}) drop-shadow(0 0 10px ${resolvedGlow})`
    : undefined;

  return (
    <div
      className={[
        bare
          ? "flex items-center justify-center px-2"
          : "flex items-center justify-center rounded-xl bg-white px-5",
        HOVER_CLASS,
      ].join(" ")}
      style={{ height: logoHeight + TILE_PADDING_Y }}
    >
      <ZeroCmsEntryField field="image" className="flex items-center justify-center">
        <CmsImage
          data={image}
          fallbackAlt={accreditationTitle ?? "Accreditation"}
          placeholderLabel=""
          sizes={`${maxWidth}px`}
          className="w-auto object-contain"
          style={{ height: logoHeight, maxWidth, filter: glow }}
        />
      </ZeroCmsEntryField>
    </div>
  );
}
