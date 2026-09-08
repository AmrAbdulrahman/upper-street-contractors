import { ZeroCmsEntry, ZeroCmsEntryField } from "@usc/zero-cms-widget";
import { RichTextViewer } from "@/components/ui/rich-text-viewer";
import type { ProseSectionFragment } from "@/generated/graphql";

type ProseSectionProps = {
  data: ProseSectionFragment;
};

/**
 * A full-width long-form copy block: a gold overline and an optional serif
 * title above a rich-text body (blocks) rendered in a narrow reading column.
 * Powers the legal pages (Privacy Policy, Terms & Conditions) and any other
 * prose page. Distinct from the Split Section (which pairs the body with an
 * image) and the home-page Who We Are section.
 *
 * `title` is optional and was added after the legal pages already existed, so
 * the spacing below the overline has to close up when there is no title —
 * otherwise every existing entry gains a gap where the title would have been.
 */
export function ProseSection({ data }: ProseSectionProps) {
  const { overline, title, body } = data;

  return (
    <ZeroCmsEntry entry={data}>
      <section className="bg-white">
        <div className="mx-auto max-w-container px-6 py-[88px]">
          {overline ? (
            <ZeroCmsEntryField field="overline">
              <p
                className={`text-[11px] font-bold tracking-[0.12em] text-gold-deep uppercase ${
                  title ? "mb-2.5" : "mb-8"
                }`}
              >
                {overline}
              </p>
            </ZeroCmsEntryField>
          ) : null}

          {title ? (
            <ZeroCmsEntryField field="title">
              <h2 className="mb-8 max-w-[26ch] font-serif text-[clamp(26px,3.5vw,42px)] leading-tight text-dark">
                {title}
              </h2>
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
