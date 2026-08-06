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

export type AccreditationProps = {
  data: AccreditationFragment;
  /** Rendered logo height in px — comes from the section's CMS `logoSize`. */
  height?: number;
};

export function Accreditation({ data, height }: AccreditationProps) {
  const { accreditationTitle, image } = data;
  const logoHeight = resolveLogoHeight(height, ACCREDITATION_LOGO_HEIGHT);
  const maxWidth = Math.round(logoHeight * LOGO_MAX_ASPECT);

  return (
    <div
      className="flex items-center justify-center rounded-xl bg-white px-5"
      style={{ height: logoHeight + TILE_PADDING_Y }}
    >
      <ZeroCmsEntryField field="image" className="flex items-center justify-center">
        <CmsImage
          data={image}
          fallbackAlt={accreditationTitle ?? "Accreditation"}
          placeholderLabel=""
          sizes={`${maxWidth}px`}
          className="w-auto object-contain"
          style={{ height: logoHeight, maxWidth }}
        />
      </ZeroCmsEntryField>
    </div>
  );
}
