import { documentToReactComponents } from "@contentful/rich-text-react-renderer";
import type { Document } from "@contentful/rich-text-types";
import {
  atAGlanceFooterRichTextOptions,
  defaultRichTextOptions,
  heroFooterRichTextOptions,
  heroTitleRichTextOptions,
} from "./rich-text-options";

type RichTextVariant =
  | "default"
  | "hero-title"
  | "hero-footer"
  | "at-a-glance-footer";

const variantOptions = {
  default: defaultRichTextOptions,
  "hero-title": heroTitleRichTextOptions,
  "hero-footer": heroFooterRichTextOptions,
  "at-a-glance-footer": atAGlanceFooterRichTextOptions,
} as const;

type RichTextElement = "div" | "h1" | "h2" | "p";

interface RichTextProps {
  document: Document;
  className?: string;
  variant?: RichTextVariant;
  /** Root element. Use a phrasing-friendly tag when nested inside headings. */
  as?: RichTextElement;
}

export function RichText({
  document,
  className,
  variant = "default",
  as: Tag = "div",
}: RichTextProps) {
  return (
    <Tag className={className}>
      {documentToReactComponents(document, variantOptions[variant])}
    </Tag>
  );
}
