import { ZeroCmsEntryField } from "@usc/zero-cms-widget";
import { CmsImage } from "@/components/ui/cms-image";
import { resolveBadgeGlow, resolveLogoHeight } from "@/helpers";
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
   * Fallback glow settings, used per-value when the badge has none of its own.
   * Each badge is a different organisation's mark with its own palette and its
   * own weight, so all three belong to the entry; these are what a newly added
   * badge gets until someone tunes it.
   *
   * `drop-shadow` follows the image's **alpha channel**, so the glow traces the
   * logo's actual silhouette rather than boxing it — which is the whole point
   * on a transparent badge, and why this is not a `box-shadow`.
   */
  glowColor?: string | null;
  /** Fallback bloom radius in px. `0` on the badge means no glow at all. */
  glowRadius?: number | null;
  /** Fallback glow opacity, 0-100. */
  glowIntensity?: number | null;
};

export function Accreditation({
  data,
  height,
  bare = false,
  glowColor,
  glowRadius,
  glowIntensity,
}: AccreditationProps) {
  const { accreditationTitle, image } = data;
  const logoHeight = resolveLogoHeight(height, ACCREDITATION_LOGO_HEIGHT);
  const maxWidth = Math.round(logoHeight * LOGO_MAX_ASPECT);

  // The badge's own settings win, value by value; the caller's are fallbacks.
  const glow = resolveBadgeGlow({
    own: {
      color: data.glowColor,
      radius: data.glowRadius,
      intensity: data.glowIntensity,
    },
    fallback: { color: glowColor, radius: glowRadius, intensity: glowIntensity },
  });

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
