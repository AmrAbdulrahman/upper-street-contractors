import { JsonLd } from "./json-ld";

type FaqItemLike = {
  question?: string | null;
  /** Rich `blocks` content — see `RichTextViewer`. */
  answer?: unknown;
};

type BlockNode = { text?: unknown; children?: unknown };

/**
 * The answer's words, without its markup.
 *
 * A local walk rather than `blocksToPlainText` from `@usc/zero-cms-core`: the
 * app imports that package only through its `/node` entry point, and pulling
 * the root barrel into a Server Component drags the browser-side editor in with
 * it. Ten lines here is cheaper than that import.
 */
function blocksToText(content: unknown): string {
  const walk = (node: unknown): string => {
    if (Array.isArray(node)) return node.map(walk).join("");
    if (!node || typeof node !== "object") return "";
    const block = node as BlockNode;
    if (typeof block.text === "string") return block.text;
    return walk(block.children);
  };

  return walk(content).replace(/\s+/g, " ").trim();
}

/**
 * The Q&A pairs of one FAQ section, as the accordion already renders them.
 *
 * Only emitted when a section actually holds items with both halves — a
 * `Question` with no answer is not a FAQ entry, and publishing it as one is a
 * structured-data claim the page does not back up.
 */
export function FaqJsonLd({ items }: { items: readonly (FaqItemLike | null)[] }) {
  const pairs = (items ?? [])
    .map((item) => ({
      question: item?.question?.trim(),
      answer: blocksToText(item?.answer),
    }))
    .filter((pair) => Boolean(pair.question) && Boolean(pair.answer));

  if (pairs.length === 0) return null;

  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: pairs.map((pair) => ({
          "@type": "Question",
          name: pair.question,
          acceptedAnswer: { "@type": "Answer", text: pair.answer },
        })),
      }}
    />
  );
}
