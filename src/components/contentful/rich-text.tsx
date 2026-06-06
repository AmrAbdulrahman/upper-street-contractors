import { documentToReactComponents } from "@contentful/rich-text-react-renderer";
import type { Document } from "@contentful/rich-text-types";
import {
  atAGlanceFooterRichTextOptions,
  bannerBodyDarkRichTextOptions,
  bannerBodyInlineRichTextOptions,
  bannerBodyLightRichTextOptions,
  defaultRichTextOptions,
  heroFooterRichTextOptions,
  heroTitleRichTextOptions,
  whatWeDoBodyRichTextOptions,
  whoWeAreBodyRichTextOptions,
  workCardBodyRichTextOptions,
} from "./rich-text-options";

type RichTextVariant =
  | "default"
  | "hero-title"
  | "hero-footer"
  | "at-a-glance-footer"
  | "who-we-are-body"
  | "work-card-body"
  | "what-we-do-body"
  | "banner-body-dark"
  | "banner-body-light"
  | "banner-body-inline";

const variantOptions = {
  default: defaultRichTextOptions,
  "hero-title": heroTitleRichTextOptions,
  "hero-footer": heroFooterRichTextOptions,
  "at-a-glance-footer": atAGlanceFooterRichTextOptions,
  "who-we-are-body": whoWeAreBodyRichTextOptions,
  "work-card-body": workCardBodyRichTextOptions,
  "what-we-do-body": whatWeDoBodyRichTextOptions,
  "banner-body-dark": bannerBodyDarkRichTextOptions,
  "banner-body-light": bannerBodyLightRichTextOptions,
  "banner-body-inline": bannerBodyInlineRichTextOptions,
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
