import type { Options } from "@contentful/rich-text-react-renderer";
import { BLOCKS, INLINES, MARKS } from "@contentful/rich-text-types";

export const defaultRichTextOptions: Options = {
  renderNode: {
    [BLOCKS.PARAGRAPH]: (_node, children) => (
      <p className="mb-4 leading-relaxed text-muted">{children}</p>
    ),
    [BLOCKS.HEADING_1]: (_node, children) => (
      <h1 className="mb-6 text-4xl text-foreground">{children}</h1>
    ),
    [BLOCKS.HEADING_2]: (_node, children) => (
      <h2 className="mb-4 text-3xl text-foreground">{children}</h2>
    ),
    [BLOCKS.HEADING_3]: (_node, children) => (
      <h3 className="mb-3 text-2xl text-foreground">{children}</h3>
    ),
    [BLOCKS.UL_LIST]: (_node, children) => (
      <ul className="mb-4 list-inside list-disc space-y-1">{children}</ul>
    ),
    [BLOCKS.OL_LIST]: (_node, children) => (
      <ol className="mb-4 list-inside list-decimal space-y-1">{children}</ol>
    ),
    [BLOCKS.LIST_ITEM]: (_node, children) => <li className="text-muted">{children}</li>,
    [INLINES.HYPERLINK]: (node, children) => (
      <a
        href={node.data.uri}
        className="text-blue-600 underline hover:text-blue-800"
        target="_blank"
        rel="noopener noreferrer"
      >
        {children}
      </a>
    ),
  },
};

export const heroTitleRichTextOptions: Options = {
  renderNode: {
    [BLOCKS.PARAGRAPH]: (_node, children) => (
      <span className="block">{children}</span>
    ),
    [BLOCKS.HEADING_1]: (_node, children) => (
      <span className="block">{children}</span>
    ),
  },
  renderMark: {
    [MARKS.ITALIC]: (text) => (
      <em className="text-gold-mid italic">{text}</em>
    ),
    [MARKS.BOLD]: (text) => (
      <strong className="font-semibold text-gold-mid">{text}</strong>
    ),
  },
};

export const heroFooterRichTextOptions: Options = {
  renderNode: {
    [BLOCKS.PARAGRAPH]: (_node, children) => (
      <p className="text-sm leading-relaxed text-subtle">{children}</p>
    ),
  },
};

export const atAGlanceFooterRichTextOptions: Options = {
  renderNode: {
    [BLOCKS.PARAGRAPH]: (_node, children) => (
      <p className="text-sm leading-snug text-subtle">{children}</p>
    ),
  },
  renderMark: {
    [MARKS.BOLD]: (text) => (
      <span className="font-medium text-gold">{text}</span>
    ),
  },
};
