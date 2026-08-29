import { ZeroCmsEntry, ZeroCmsEntryField } from "@usc/zero-cms-widget";
import Link from "next/link";
import { CmsImage } from "@/components/ui/cms-image";
import { Icon } from "@/components/ui/icon";
import { iconData } from "@/helpers";
import type { ServiceCardFragment } from "@/generated/graphql";

type ServiceCardProps = {
  data: ServiceCardFragment;
  /** Above the fold — load eagerly rather than letting it become a late LCP. */
  priority?: boolean;
};

// The Project card's chrome, deliberately: the two grids are the same shape at
// the same width, and a visitor moving between /projects and /services should
// not feel they have changed site.
const cardClasses =
  "group flex h-full flex-col overflow-hidden rounded-lg border border-border bg-white transition-all duration-250 ease-out hover:-translate-y-[3px] hover:shadow-lg motion-reduce:transition-none motion-reduce:hover:translate-y-0";

export function ServiceCard({ data, priority = false }: ServiceCardProps) {
  const { title, summary, href, image } = data;

  // A card with nowhere to go is a card that should not be a card. Falling back
  // to the Services index keeps it clickable rather than rendering a dead tile.
  const target = href?.trim() || "/services";

  return (
    <ZeroCmsEntry entry={data}>
      <article className={cardClasses}>
        {/* Clickable, but hidden from assistive tech: the title and "Learn
            more" beneath already link the same page, and the photo is a reused
            Project hero whose own alt names that project — so a screen reader
            heard "Home Renovation" for the Refurbishments card. Three links to
            one destination is noise; one of them should be the mouse's. */}
        <Link href={target} className="block" aria-hidden tabIndex={-1}>
          <ZeroCmsEntryField field="image">
            <div className="relative aspect-[4/3] overflow-hidden bg-surface">
              <CmsImage
                data={image}
                fallbackAlt={title ?? "Service"}
                className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
                placeholderLabel="Service photo"
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 360px"
                priority={priority}
              />
            </div>
          </ZeroCmsEntryField>
        </Link>

        <div className="flex flex-1 flex-col p-[18px]">
          <Link href={target} className="block">
            {title ? (
              <ZeroCmsEntryField field="title">
                <h3 className="mb-1.5 font-sans text-[15px] leading-snug font-semibold text-dark">
                  {title}
                </h3>
              </ZeroCmsEntryField>
            ) : null}

            {summary ? (
              <ZeroCmsEntryField field="summary">
                {/* Three lines, like the Blog card's excerpt, so a row of cards
                    stays even however long an editor's copy runs. */}
                <p className="line-clamp-3 text-[13px] leading-[1.55] text-muted">
                  {summary}
                </p>
              </ZeroCmsEntryField>
            ) : null}
          </Link>

          <Link
            href={target}
            className="mt-auto inline-flex items-center gap-1.5 pt-3.5 font-sans text-[13px] font-semibold text-gold transition-colors hover:text-gold-deep"
          >
            {/* The service name rides in the accessible name so a screen reader
                listing links does not hear "Learn more" nine times. */}
            <span aria-hidden>Learn more</span>
            <span className="sr-only">Learn more about {title ?? "this service"}</span>

            <Icon
              data={iconData("arrow-right")}
              className="h-3.5 w-3.5 shrink-0 transition-transform duration-250 group-hover:translate-x-0.5 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0"
            />
          </Link>
        </div>
      </article>
    </ZeroCmsEntry>
  );
}
