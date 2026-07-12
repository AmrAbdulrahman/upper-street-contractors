"use client";

import { ZeroCmsBlocks } from "@usc/zero-cms-blocks";

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
  | "banner-body-inline"
  | "review-card-body"
  | "planning-renovation-footer"
  | "prose";

type RichTextElement = "div" | "h1" | "h2" | "p";

interface RichTextProps {
  content: unknown;
  className?: string;
  variant?: RichTextVariant;
  as?: RichTextElement;
}

const paragraphClasses: Record<RichTextVariant, string> = {
  default: "mb-4 leading-relaxed text-muted",
  "hero-title": "block",
  "hero-footer": "text-sm leading-relaxed text-subtle",
  "at-a-glance-footer": "text-sm leading-snug text-subtle",
  "who-we-are-body": "text-[17px] leading-[1.7] text-muted",
  "work-card-body":
    "text-[15px] leading-relaxed text-muted transition-colors group-hover:text-subtle",
  "what-we-do-body": "text-[17px] leading-[1.7] text-muted",
  "banner-body-dark": "text-sm leading-relaxed text-subtle",
  "banner-body-light": "text-sm leading-relaxed text-muted",
  "banner-body-inline": "text-sm leading-relaxed text-inherit",
  "review-card-body": "italic text-[15px] leading-relaxed text-muted",
  "planning-renovation-footer": "text-[13px] leading-relaxed text-white/60",
  prose: "mb-5 text-[16px] leading-[1.75] text-muted",
};

const headingClasses: Record<RichTextVariant, string> = {
  default: "mb-4 text-3xl text-foreground",
  "hero-title": "block text-4xl leading-[1.15] tracking-tight text-white sm:text-5xl",
  "hero-footer": "text-sm leading-relaxed text-subtle",
  "at-a-glance-footer": "text-sm leading-snug text-subtle",
  "who-we-are-body": "text-[17px] leading-[1.7] text-muted",
  "work-card-body":
    "text-[15px] leading-relaxed text-muted transition-colors group-hover:text-subtle",
  "what-we-do-body": "text-[17px] leading-[1.7] text-muted",
  "banner-body-dark": "text-sm leading-relaxed text-subtle",
  "banner-body-light": "text-sm leading-relaxed text-muted",
  "banner-body-inline": "text-sm leading-relaxed text-inherit",
  "review-card-body": "italic text-[15px] leading-relaxed text-muted",
  "planning-renovation-footer": "text-[13px] leading-relaxed text-white/60",
  prose: "mt-10 mb-4 font-serif text-2xl text-dark",
};

// Prose headings size by level (legal / long-form pages). The single
// per-variant class above can't tell an h2 from an h3, so the "prose" variant
// resolves its heading class from here instead — giving real hierarchy for SEO
// + a11y without changing any other variant.
const proseHeadingClasses: Record<number, string> = {
  1: "mt-10 mb-4 font-serif text-3xl text-dark",
  2: "mt-10 mb-4 font-serif text-2xl text-dark",
  3: "mt-8 mb-3 font-serif text-xl text-dark",
  4: "mt-6 mb-2 text-lg font-semibold text-dark",
  5: "mt-6 mb-2 text-base font-semibold text-dark",
  6: "mt-6 mb-2 text-base font-semibold text-dark",
};

function isBlocksContent(value: unknown): value is unknown[] {
  return Array.isArray(value) && value.length > 0;
}

export function RichTextViewer({
  content,
  className,
  variant = "default",
  as: Tag = "div",
}: RichTextProps) {
  if (!isBlocksContent(content)) {
    return null;
  }

  return (
    <Tag className={className}>
      <ZeroCmsBlocks
        content={content}
        blocks={{
          paragraph: ({ children }) => (
            <p className={paragraphClasses[variant]}>{children}</p>
          ),
          heading: ({ children, level }) => {
            if (variant === "hero-title" && level === 1) {
              return (
                <span className={headingClasses[variant]}>{children}</span>
              );
            }

            const HeadingTag = `h${level}` as "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
            const headingClass =
              variant === "prose"
                ? (proseHeadingClasses[level] ?? proseHeadingClasses[6])
                : headingClasses[variant];
            return (
              <HeadingTag className={headingClass}>{children}</HeadingTag>
            );
          },
          list: ({ children, format }) => {
            const ListTag = format === "ordered" ? "ol" : "ul";
            const listClass =
              format === "ordered"
                ? "mb-4 list-inside list-decimal space-y-1"
                : "mb-4 list-inside list-disc space-y-1";
            return <ListTag className={listClass}>{children}</ListTag>;
          },
          "list-item": ({ children }) => (
            <li className="text-muted">{children}</li>
          ),
          quote: ({ children }) => (
            <blockquote className="mb-4 border-l-4 border-gold pl-4 italic text-muted">
              {children}
            </blockquote>
          ),
          link: ({ children, url }) => (
            <a
              href={url}
              className={
                variant === "planning-renovation-footer"
                  ? "text-white/65 underline hover:text-white/80"
                  : "text-gold underline hover:text-gold-mid"
              }
            >
              {children}
            </a>
          ),
        }}
        modifiers={{
          bold: ({ children }) => {
            if (variant === "hero-title") {
              return (
                <strong className="font-semibold text-gold-mid">{children}</strong>
              );
            }
            if (
              variant === "at-a-glance-footer" ||
              variant === "banner-body-inline"
            ) {
              return <span className="font-bold text-gold-mid">{children}</span>;
            }
            return <strong>{children}</strong>;
          },
          italic: ({ children }) => {
            if (variant === "hero-title") {
              return <em className="text-gold-mid italic">{children}</em>;
            }
            return <em>{children}</em>;
          },
          strikethrough: ({ children }) => <s>{children}</s>,
          code: ({ children }) => (
            <code className="rounded bg-surface px-1 py-0.5 text-[0.9em] text-foreground">
              {children}
            </code>
          ),
        }}
      />
    </Tag>
  );
}
