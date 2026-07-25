import { ZeroCmsEntry, ZeroCmsEntryField } from "@usc/zero-cms-widget";
import type { QuoteSectionFragment } from "@/generated/graphql";

type QuoteSectionProps = {
  data: QuoteSectionFragment;
};

/**
 * A pull-quote: one emphasised line of copy with an optional attribution,
 * marked up as a real <blockquote>/<cite> so the emphasis is structural rather
 * than only visual. Distinct from a Client Comment (tied to one Project) and a
 * Review card (site-wide social proof with a star score).
 */
export function QuoteSection({ data }: QuoteSectionProps) {
  const { quote, attribution } = data;
  if (!quote) return null;

  return (
    <ZeroCmsEntry entry={data}>
      <section className="bg-white">
        <div className="mx-auto max-w-container px-6 py-[56px]">
          <figure className="mx-auto max-w-[68ch] border-l-4 border-l-gold pl-6">
            <ZeroCmsEntryField field="quote">
              <blockquote className="font-serif text-xl leading-relaxed text-dark/90 italic sm:text-2xl">
                {`“${quote}”`}
              </blockquote>
            </ZeroCmsEntryField>
            {attribution ? (
              <ZeroCmsEntryField field="attribution">
                <figcaption className="mt-4 text-sm font-semibold text-muted not-italic">
                  — <cite className="not-italic">{attribution}</cite>
                </figcaption>
              </ZeroCmsEntryField>
            ) : null}
          </figure>
        </div>
      </section>
    </ZeroCmsEntry>
  );
}
