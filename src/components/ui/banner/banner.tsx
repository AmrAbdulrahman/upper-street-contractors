import { ContentfulEntry, ContentfulEntryField } from "@/components/contentful";
import { RichText } from "@/components/contentful/rich-text";
import { Button } from "@/components/ui/button";
import { BannerFragment } from "@/generated/graphql";
import type { Document } from "@contentful/rich-text-types";

export const BANNER_VARIANTS = ["dark", "light", "note", "transparent"] as const;
export type BannerVariant = (typeof BANNER_VARIANTS)[number];

type BannerProps = {
  data: BannerFragment;
  className?: string;
};

export function normalizeBannerVariant(variant?: string | null): BannerVariant {
  const key = variant?.trim().toLowerCase();

  if (key === "dark") return "dark";
  if (key === "light") return "light";
  if (key === "note") return "note";
  if (key === "transparent") return "transparent";

  return "light";
}

const variantContainerClasses: Record<
  BannerVariant,
  { base: string; hoverable: string }
> = {
  dark: {
    base: "border-white/10 bg-dark text-white",
    hoverable: "hover:border-gold/60",
  },
  light: {
    base: "border-gold/40 bg-gold-light/40 text-dark",
    hoverable: "hover:border-gold",
  },
  note: {
    base: "border-border border-l-4 border-l-gold bg-gold-light/30 text-dark",
    hoverable: "hover:border-gold",
  },
  transparent: {
    base: "border-border bg-transparent text-muted",
    hoverable: "hover:border-gold/60",
  },
};

const titleClasses: Record<BannerVariant, string> = {
  dark: "font-bold text-white",
  light: "font-bold text-dark",
  note: "font-bold text-dark",
  transparent: "font-bold text-dark",
};

function getRichTextVariant(
  bannerVariant: BannerVariant,
  hasTitle: boolean,
): "banner-body-dark" | "banner-body-light" | "banner-body-inline" {
  if (!hasTitle) {
    return "banner-body-inline";
  }

  return bannerVariant === "dark" ? "banner-body-dark" : "banner-body-light";
}

export function Banner({ data, className = "" }: BannerProps) {
  const { title, body, emoji, variant, hoverable, button } = data;
  const bodyDocument = body?.json as Document | undefined;
  const bannerVariant = normalizeBannerVariant(variant);
  const hasTitle = Boolean(title?.trim());
  const hasButton = Boolean(button);
  const { base, hoverable: hoverableClass } = variantContainerClasses[bannerVariant];
  const richTextVariant = getRichTextVariant(bannerVariant, hasTitle);

  const containerClasses = [
    "flex w-full flex-col items-start gap-4 rounded-xl border border-2 px-5 py-4 md:flex-row md:items-center md:gap-6 md:px-6 md:py-5",
    hoverable
      ? "transition-[border-color] duration-500 ease-in-out"
      : "transition-colors duration-300",
    base,
    hoverable ? hoverableClass : "",
    hasButton ? "md:justify-between" : "justify-center",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const contentBlock = hasTitle ? (
    <div className="min-w-0 flex flex-col gap-1">
      <div className="flex items-center gap-2.5">
        {emoji ? (
          <ContentfulEntryField field="emoji" as="span">
            <span aria-hidden className="shrink-0 text-lg leading-none">
              {emoji}
            </span>
          </ContentfulEntryField>
        ) : null}

        {title ? (
          <ContentfulEntryField field="title" as="span">
            <span className={titleClasses[bannerVariant]}>{title}</span>
          </ContentfulEntryField>
        ) : null}
      </div>

      {bodyDocument ? (
        <ContentfulEntryField field="body" className="min-w-0">
          <RichText
            document={bodyDocument}
            variant={richTextVariant}
            className={hasButton ? "max-w-2xl" : undefined}
          />
        </ContentfulEntryField>
      ) : null}
    </div>
  ) : (
    <div className="flex min-w-0 items-center gap-2.5">
      {emoji ? (
        <ContentfulEntryField field="emoji" as="span">
          <span aria-hidden className="shrink-0 text-lg leading-none">
            {emoji}
          </span>
        </ContentfulEntryField>
      ) : null}

      {bodyDocument ? (
        <ContentfulEntryField field="body" className="min-w-0">
          <RichText document={bodyDocument} variant={richTextVariant} />
        </ContentfulEntryField>
      ) : null}
    </div>
  );

  return (
    <ContentfulEntry entry={data}>
      <div className={containerClasses}>
        {contentBlock}

        {hasButton && button ? (
          <ContentfulEntry entry={button}>
            <Button data={button} className="w-full shrink-0 md:w-auto" />
          </ContentfulEntry>
        ) : null}
      </div>
    </ContentfulEntry>
  );
}
