import { ZeroCmsEntry } from "@usc/zero-cms-widget";
import type { SeparatorSectionFragment } from "@/generated/graphql";

type SeparatorSectionProps = {
  data: SeparatorSectionFragment;
};

/**
 * A visual break between blocks. `space` is whitespace only, so it renders no
 * <hr> — a horizontal rule announces "thematic break" to a screen reader, and
 * pure breathing room is not one. `line` and `dots` are real breaks and do.
 */
export function SeparatorSection({ data }: SeparatorSectionProps) {
  const variant = data.variant ?? "line";

  return (
    <ZeroCmsEntry entry={data}>
      <section className="bg-white">
        <div className="mx-auto max-w-container px-6 py-8">
          <div className="mx-auto max-w-[75ch]">
            {variant === "space" ? (
              <div className="h-8" />
            ) : variant === "dots" ? (
              <hr className="border-0 text-center text-xl tracking-[0.6em] text-gold-deep before:content-['•••']" />
            ) : (
              <hr className="border-0 border-t border-border" />
            )}
          </div>
        </div>
      </section>
    </ZeroCmsEntry>
  );
}
