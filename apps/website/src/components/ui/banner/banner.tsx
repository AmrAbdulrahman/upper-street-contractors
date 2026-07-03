import { ZeroCmsEntry, ZeroCmsEntryField } from "@usc/zero-cms-widget";
import { RichTextViewer } from "@/components/ui/rich-text-viewer";
import { Button } from "@/components/ui/button";
import { BannerFragment } from "@/generated/graphql";

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

const sharedLayoutClasses =
  "flex w-full flex-col items-start gap-4 px-5 py-4 md:flex-row md:items-center md:gap-6 md:px-6 md:py-5";

const variantContainerClasses: Record<
  BannerVariant,
  { base: string; hoverable: string }
> = {
  dark: {
    base: "rounded-sm border-2 border-white/10 bg-dark text-white",
    hoverable: "hover:border-gold/60",
  },
  light: {
    base: "rounded-sm border-2 border-gold/40 bg-gold/15 text-light",
    hoverable: "hover:border-gold",
  },
  note: {
    base: "rounded-sm border border-border border-l-4 border-l-gold bg-gold-light text-dark",
    hoverable: "hover:border-gold",
  },
  transparent: {
    base: "rounded-sm border-2 border-border bg-transparent text-muted",
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
  const bannerVariant = normalizeBannerVariant(variant);
  const hasTitle = Boolean(title?.trim());
  const hasButton = Boolean(button);
  const { base, hoverable: hoverableClass } = variantContainerClasses[bannerVariant];
  const richTextVariant = getRichTextVariant(bannerVariant, hasTitle);

  const containerClasses = [
    sharedLayoutClasses,
    base,
    hoverable
      ? "transition-[border-color] duration-500 ease-in-out"
      : "transition-colors duration-300",
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
          <ZeroCmsEntryField field="emoji" as="span">
            <span aria-hidden className="shrink-0 text-lg leading-none">
              {emoji}
            </span>
          </ZeroCmsEntryField>
        ) : null}

        {title ? (
          <ZeroCmsEntryField field="title" as="span">
            <span className={titleClasses[bannerVariant]}>{title}</span>
          </ZeroCmsEntryField>
        ) : null}
      </div>

      {body ? (
        <ZeroCmsEntryField field="body" className="min-w-0">
          <RichTextViewer
            content={body}
            variant={richTextVariant}
            className={hasButton ? "max-w-2xl" : undefined}
          />
        </ZeroCmsEntryField>
      ) : null}
    </div>
  ) : (
    <div className="flex min-w-0 items-center gap-2.5">
      {emoji ? (
        <ZeroCmsEntryField field="emoji" as="span">
          <span aria-hidden className="shrink-0 text-lg leading-none">
            {emoji}
          </span>
        </ZeroCmsEntryField>
      ) : null}

      {body ? (
        <ZeroCmsEntryField field="body" className="min-w-0">
          <RichTextViewer content={body} variant={richTextVariant} />
        </ZeroCmsEntryField>
      ) : null}
    </div>
  );

  return (
    <ZeroCmsEntry entry={data}>
      <div className={containerClasses}>
        {contentBlock}

        {hasButton && button ? (
          <ZeroCmsEntry entry={button}>
            <Button data={button} className="w-full shrink-0 md:w-auto" />
          </ZeroCmsEntry>
        ) : null}
      </div>
    </ZeroCmsEntry>
  );
}
