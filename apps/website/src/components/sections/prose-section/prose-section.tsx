import { ZeroCmsEntry, ZeroCmsEntryField } from "@usc/zero-cms-widget";
import { RichTextViewer } from "@/components/ui/rich-text-viewer";
import type { ProseSectionFragment } from "@/generated/graphql";

type ProseSectionProps = {
  data: ProseSectionFragment;
};

/**
 * A full-width long-form copy block: a gold overline above a rich-text body
 * (blocks) rendered in a narrow reading column. Powers the legal pages
 * (Privacy Policy, Terms & Conditions) and any other prose page. Distinct from
 * the Split Section (which pairs the body with an image) and the home-page
 * Who We Are section.
 */
export function ProseSection({ data }: ProseSectionProps) {
  const { overline, body } = data;

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

          {body ? (
            <ZeroCmsEntryField field="body">
              <RichTextViewer
                content={body}
                variant="prose"
                className="max-w-[75ch]"
              />
            </ZeroCmsEntryField>
          ) : null}
        </div>
      </section>
    </ZeroCmsEntry>
  );
}
