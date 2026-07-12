import {
  AddZeroCmsEntry,
  ZeroCmsEntry,
  ZeroCmsEntryField,
} from "@usc/zero-cms-widget";
import { RichTextViewer } from "@/components/ui/rich-text-viewer";
import type { FaqItemFragment, FaqSectionFragment } from "@/generated/graphql";

type FaqSectionProps = {
  data: FaqSectionFragment;
};

/**
 * FAQ section: a gold overline + serif title above a One-to-Many list of FAQ
 * items, rendered as a single-open accordion. Uses native <details>/<summary>
 * sharing a `name` (exclusive open, one row at a time) — zero client JS,
 * keyboard + screen-reader accessible, and fully crawlable (answers live in the
 * DOM). Each row self-wraps in its own ZeroCmsEntry so Inspect mode's pencil
 * opens that faq-item.
 */
export function FaqSection({ data }: FaqSectionProps) {
  const { overline, title } = data;
  const items = (data.items ?? []).filter(Boolean) as FaqItemFragment[];
  // Scope the exclusive-accordion group to this section so two FAQ sections on
  // one page don't collapse each other.
  const groupName = `faq-${data.id}`;

  return (
    <ZeroCmsEntry entry={data}>
      <section className="bg-white">
        <div className="mx-auto max-w-container px-6 py-[88px]">
          <div className="mx-auto max-w-3xl">
            {overline ? (
              <ZeroCmsEntryField field="overline">
                <p className="text-[11px] font-bold tracking-[0.12em] text-gold-deep uppercase">
                  {overline}
                </p>
              </ZeroCmsEntryField>
            ) : null}

            {title ? (
              <ZeroCmsEntryField field="title">
                <h2 className="mt-2.5 font-serif text-[clamp(26px,3.5vw,42px)] leading-tight text-dark">
                  {title}
                </h2>
              </ZeroCmsEntryField>
            ) : null}

            <div className="mt-10 divide-y divide-border overflow-hidden rounded-2xl border border-border">
              {items.map((item) => (
                <FaqRow key={item.id} item={item} groupName={groupName} />
              ))}
              <AddZeroCmsEntry field="items" />
            </div>
          </div>
        </div>
      </section>
    </ZeroCmsEntry>
  );
}

function FaqRow({
  item,
  groupName,
}: {
  item: FaqItemFragment;
  groupName: string;
}) {
  return (
    <ZeroCmsEntry entry={item}>
      <details name={groupName} className="group bg-white open:bg-surface/40">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-left [&::-webkit-details-marker]:hidden">
          <ZeroCmsEntryField field="question">
            <span className="font-serif text-lg text-dark">{item.question}</span>
          </ZeroCmsEntryField>
          <span
            aria-hidden
            className="shrink-0 text-2xl leading-none text-gold transition-transform duration-200 group-open:rotate-45"
          >
            +
          </span>
        </summary>

        {item.answer ? (
          <ZeroCmsEntryField field="answer">
            <div className="px-5 pb-5">
              <RichTextViewer content={item.answer} variant="prose" />
            </div>
          </ZeroCmsEntryField>
        ) : null}
      </details>
    </ZeroCmsEntry>
  );
}
