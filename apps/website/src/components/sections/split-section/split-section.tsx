import { ZeroCmsEntry, ZeroCmsEntryField } from "@usc/zero-cms-widget";
import { CmsImage } from "@/components/ui/cms-image";
import { RichTextViewer } from "@/components/ui/rich-text-viewer";
import type { SplitSectionFragment } from "@/generated/graphql";

type SplitSectionProps = {
  data: SplitSectionFragment;
};

/**
 * A two-column split: the overline spans full width on top, with the body text
 * and the image side by side beneath it. `imagePosition` ("start" | "end")
 * chooses which side the image sits on at `lg`+ (the text always takes the
 * opposite side). The DOM order stays overline → body → image so the reading
 * order is stable; only the desktop visual order swaps.
 */
export function SplitSection({ data }: SplitSectionProps) {
  const { overline, body, image, imagePosition } = data;
  const imageStart = imagePosition === "start";

  return (
    <ZeroCmsEntry entry={data}>
      <section className="bg-white">
        <div className="mx-auto max-w-container px-6 py-[88px]">
          {overline ? (
            <ZeroCmsEntryField field="overline">
              <p className="mb-8 text-[11px] font-bold tracking-[0.12em] text-gold-deep uppercase">
                {overline}
              </p>
            </ZeroCmsEntryField>
          ) : null}

          <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
            {body ? (
              <ZeroCmsEntryField field="body">
                <RichTextViewer
                  content={body}
                  variant="who-we-are-body"
                  className="flex flex-col gap-5"
                />
              </ZeroCmsEntryField>
            ) : null}

            <ZeroCmsEntryField field="image">
              <div className={`min-w-0${imageStart ? " lg:order-first" : ""}`}>
                <CmsImage
                  data={image}
                  fallbackAlt={overline ?? "Renovation work"}
                  placeholderLabel="Section image placeholder"
                  sizes="(max-width: 1024px) 100vw, 536px"
                  className="h-[340px] w-full rounded-2xl object-cover"
                />
              </div>
            </ZeroCmsEntryField>
          </div>
        </div>
      </section>
    </ZeroCmsEntry>
  );
}
