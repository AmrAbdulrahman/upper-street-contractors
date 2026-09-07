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
  /** Just created by this editor — see `useCardFlash`. */
  flash?: boolean;
};

// The Project card's chrome, deliberately: the two grids are the same shape at
// the same width, and a visitor moving between /projects and /services should
// not feel they have changed site.
// The lift, the shadow and the reduced-motion opt-out all come from
// `card-lift` now (globals.css) — this used to carry its own copy of all three.
const cardClasses =
  "card-lift group flex h-full flex-col overflow-hidden rounded-lg border border-border bg-white";

export function ServiceCard({
  data,
  priority = false,
  flash = false,
}: ServiceCardProps) {
  const { title, summary, page, image } = data;

  // Derived from the linked page's own slug, never typed out. While the card
  // carried a free-text `href`, the card and the page it meant were two strings
  // an editor could change independently — and a typo in one silently produced
  // a card linking to a 404.
  //
  // A card with nowhere to go is a card that should not be a card. Falling back
  // to the Services index keeps it clickable rather than rendering a dead tile.
  const target = page?.slug ? `/${page.slug}` : "/services";

  return (
    <ZeroCmsEntry entry={data}>
      {/* The flash class goes on the existing <article>, never a wrapper:
          <ZeroCmsEntry> clones a lone host element rather than wrapping it, and
          an extra div here would stop this being a direct grid item. */}
      <article className={flash ? `${cardClasses} card-flash` : cardClasses}>
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
                className="card-zoom h-full w-full object-cover"
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
