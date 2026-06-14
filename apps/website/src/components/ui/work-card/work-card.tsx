import { StrapiEntry, StrapiEntryField } from "@/components/strapi";
import { RichText } from "@/components/strapi/rich-text";
import { Icon } from "@/components/ui/icon";
import { WorkCardFragment } from "@/generated/graphql";
import Link from "next/link";

type WorkCardProps = {
  data: WorkCardFragment;
};

export function WorkCard({ data }: WorkCardProps) {
  const { emoji, title, body, href, linkText, priceLine } = data;

  const cardClasses = [
    "group relative flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-white p-7 shadow-sm",
    "transition-[background-color,border-color] duration-300 ease-out",
    "before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:z-10 before:h-1 before:rounded-t-2xl before:bg-gold before:content-['']",
    "before:opacity-0 before:transition-opacity before:duration-300 before:ease-out",
    "hover:border-gold/50 hover:bg-dark hover:before:opacity-100",
  ].join(" ");

  const content = (
    <>
      {emoji ? (
        <StrapiEntryField field="emoji" as="span">
          <span
            aria-hidden
            className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-gold-light text-xl transition-colors group-hover:bg-white/10"
          >
            {emoji}
          </span>
        </StrapiEntryField>
      ) : null}

      {title ? (
        <StrapiEntryField field="title">
          <h3 className="mt-5 truncate font-serif text-2xl leading-tight text-dark transition-colors group-hover:text-white">
            {title}
          </h3>
        </StrapiEntryField>
      ) : null}

      {body ? (
        <StrapiEntryField field="body" className="mt-3 min-w-0">
          <RichText content={body} variant="work-card-body" />
        </StrapiEntryField>
      ) : null}

      {priceLine ? (
        <StrapiEntryField field="priceLine">
          <p className="mt-5 text-sm font-bold text-gold">{priceLine}</p>
        </StrapiEntryField>
      ) : null}

      {linkText ? (
        <StrapiEntryField field="linkText">
          <p className="mt-4 flex items-center gap-1.5 text-sm font-bold text-gold transition-colors group-hover:text-white">
            {linkText}
            <Icon data={{ code: "arrow-right" }} className="h-4 w-4 shrink-0" />
          </p>
        </StrapiEntryField>
      ) : null}
    </>
  );

  if (href) {
    return (
      <StrapiEntry entry={data}>
        <Link href={href} className={cardClasses}>
          {content}
        </Link>
      </StrapiEntry>
    );
  }

  return (
    <StrapiEntry entry={data}>
      <article className={cardClasses}>{content}</article>
    </StrapiEntry>
  );
}
