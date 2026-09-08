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

/**
 * Heading sizes by level, per variant.
 *
 * A heading block has always carried its level — `blocks-html.ts` stores it and
 * the renderer hands it over — but every variant except `prose` resolved to one
 * class and threw the level away, so an h1 and an h2 came out the same size. In
 * the ten body/card variants the heading class was byte-for-byte the paragraph
 * class, so a heading was indistinguishable from body copy at any level.
 *
 * Long-form variants get a display scale. Body/card variants get a compact one:
 * a heading inside a Review card or a banner should read as a heading without
 * blowing the card open, and each keeps its own colour so a heading on navy
 * stays legible.
 */
type HeadingScale = Record<number, string>;

/**
 * Sizes for a heading inside body copy — a step above the paragraph, not a title.
 *
 * Every level clears 17px, the largest paragraph any of these variants uses
 * (who-we-are-body / what-we-do-body). A heading that lands on exactly the
 * paragraph size is carrying its whole meaning in font-weight, which is not
 * enough to read as a heading when it sits directly above one.
 */
const COMPACT_SIZES: HeadingScale = {
  1: "text-[24px]",
  2: "text-[20px]",
  3: "text-[18px]",
  4: "text-[18px]",
  5: "text-[18px]",
  6: "text-[18px]",
};

/**
 * A body/card heading scale in the variant's own colour.
 *
 * `first:mt-0` because these bodies often open on a heading, and a top margin
 * there pushes the copy away from whatever it sits under.
 */
function compactHeadings(tone: string): HeadingScale {
  const scale: HeadingScale = {};
  for (const level of [1, 2, 3, 4, 5, 6]) {
    scale[level] = `mt-5 mb-1.5 font-semibold leading-snug first:mt-0 ${COMPACT_SIZES[level]} ${tone}`;
  }
  return scale;
}

/** The home hero title is one line of display type — level does not size it. */
const HERO_TITLE_HEADINGS: HeadingScale = {
  1: "block text-4xl leading-[1.15] tracking-tight text-white sm:text-5xl",
  2: "block text-4xl leading-[1.15] tracking-tight text-white sm:text-5xl",
  3: "block text-4xl leading-[1.15] tracking-tight text-white sm:text-5xl",
  4: "block text-4xl leading-[1.15] tracking-tight text-white sm:text-5xl",
  5: "block text-4xl leading-[1.15] tracking-tight text-white sm:text-5xl",
  6: "block text-4xl leading-[1.15] tracking-tight text-white sm:text-5xl",
};

const headingClasses: Record<RichTextVariant, HeadingScale> = {
  default: {
    1: "mt-8 mb-4 font-serif text-3xl text-foreground first:mt-0",
    2: "mt-8 mb-3 font-serif text-2xl text-foreground first:mt-0",
    3: "mt-6 mb-3 font-serif text-xl text-foreground first:mt-0",
    4: "mt-6 mb-2 text-lg font-semibold text-foreground first:mt-0",
    5: "mt-6 mb-2 text-base font-semibold text-foreground first:mt-0",
    6: "mt-6 mb-2 text-base font-semibold text-foreground first:mt-0",
  },
  "hero-title": HERO_TITLE_HEADINGS,
  "hero-footer": compactHeadings("text-subtle"),
  "at-a-glance-footer": compactHeadings("text-subtle"),
  "who-we-are-body": compactHeadings("text-dark"),
  "work-card-body": compactHeadings("text-dark"),
  "what-we-do-body": compactHeadings("text-dark"),
  "banner-body-dark": compactHeadings("text-white"),
  "banner-body-light": compactHeadings("text-dark"),
  "banner-body-inline": compactHeadings("text-inherit"),
  "review-card-body": compactHeadings("text-dark not-italic"),
  "planning-renovation-footer": compactHeadings("text-white/80"),
  prose: {
    1: "mt-10 mb-4 font-serif text-4xl text-dark first:mt-0",
    2: "mt-10 mb-4 font-serif text-3xl text-dark first:mt-0",
    3: "mt-8 mb-3 font-serif text-2xl text-dark first:mt-0",
    4: "mt-6 mb-2 text-lg font-semibold text-dark first:mt-0",
    5: "mt-6 mb-2 text-base font-semibold text-dark first:mt-0",
    6: "mt-6 mb-2 text-base font-semibold text-dark first:mt-0",
  },
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
            const headingClass =
              headingClasses[variant][level] ?? headingClasses[variant][6];

            // The home hero already renders this block inside its own <h1>
            // (`as="h1"`), so the heading here has to stay a <span> — nesting a
            // second h1 inside the first is not markup any reader can use.
            if (variant === "hero-title" && level === 1) {
              return <span className={headingClass}>{children}</span>;
            }

            const HeadingTag = `h${level}` as "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
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
          // The default renderer emits a bare <img> with no max-width, which
          // overflows every one of the narrow variants above. A plain <img>
          // rather than next/image on purpose: the URL comes from the media
          // store and can be on any host, and an unconfigured remote host is a
          // hard error in next/image rather than an unoptimised picture.
          //
          // The size an editor types into the image dialog is stored on the
          // block and has to survive to here. It did not: `w-full` is
          // `width: 100%`, and a class beats the `width` attribute, so every
          // image rendered at full column width no matter what the dialog said.
          //
          // So a sized image gets its width from the block and `max-w-full` to
          // stay inside a narrow column on a small screen; an image with no
          // stored size keeps filling the column, which is what every existing
          // one already does. `h-auto` in both cases — the height attribute is
          // still emitted, so the browser reserves the right box from the
          // aspect ratio and the copy below does not jump when the file lands.
          image: ({ image }) => {
            const width = image.width ?? undefined;
            const sized = typeof width === "number" && width > 0;
            return (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={image.url}
                alt={image.alternativeText ?? ""}
                width={width}
                height={image.height ?? undefined}
                loading="lazy"
                decoding="async"
                className={`img-zoom my-6 h-auto rounded-lg ${sized ? "max-w-full" : "w-full"}`}
                style={sized ? { width } : undefined}
              />
            );
          },
          code: ({ plainText }) => (
            <pre className="mb-4 overflow-x-auto rounded-lg bg-dark p-4 text-[13px] leading-relaxed text-white">
              <code>{plainText}</code>
            </pre>
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
