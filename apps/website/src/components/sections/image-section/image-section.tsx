import { ZeroCmsEntry, ZeroCmsEntryField } from "@usc/zero-cms-widget";
import { CmsImage } from "@/components/ui/cms-image";
import type { ImageSectionFragment } from "@/generated/graphql";

type ImageSectionProps = {
  data: ImageSectionFragment;
};

/**
 * `width` controls how far the photo spans. Mapped through a lookup rather than
 * interpolated, because Tailwind cannot compile a class built at runtime.
 * `narrow` matches the reading column a Prose Section uses, so an image dropped
 * between two text blocks lines up with them.
 */
const WIDTHS: Record<string, string> = {
  narrow: "max-w-[75ch]",
  wide: "max-w-container",
  full: "max-w-none",
};

/**
 * One photo with an optional caption — the plainest block a post can hold, and
 * the thing an editor reaches for between two stretches of copy. Distinct from
 * the Gallery section (many photos) and the Split Section (photo beside text).
 */
export function ImageSection({ data }: ImageSectionProps) {
  const { image, caption, width } = data;

  return (
    <ZeroCmsEntry entry={data}>
      <section className="bg-white">
        <div className="mx-auto max-w-container px-6 py-10">
          <figure className={`mx-auto ${WIDTHS[width ?? "wide"] ?? WIDTHS.wide}`}>
            <ZeroCmsEntryField field="image">
              <CmsImage
                data={image}
                fallbackAlt={caption ?? "Renovation work"}
                placeholderLabel="Image placeholder"
                sizes="(max-width: 1024px) 100vw, 1120px"
                className="h-auto w-full rounded-2xl object-cover"
              />
            </ZeroCmsEntryField>

            {caption ? (
              <ZeroCmsEntryField field="caption">
                <figcaption className="mt-3 text-sm text-muted">{caption}</figcaption>
              </ZeroCmsEntryField>
            ) : null}
          </figure>
        </div>
      </section>
    </ZeroCmsEntry>
  );
}
