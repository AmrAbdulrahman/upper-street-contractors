import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import { iconData } from "@/helpers";

type QuickContactProps = {
  /** Resolved from SiteMetaConfig; the WhatsApp tab is hidden when null. */
  whatsappUrl: string | null;
  quoteHref?: string;
};

// Collapsed = icon-only tab peeking from the right edge; on hover/focus the
// label stretches out to the left (max-width transition, ease-in-out). CSS-only,
// so this stays a server component with zero client JS.
// No shared hover: the two tabs invert differently. The quote tab follows the
// site-wide gold rule (white fill, gold label); the WhatsApp tab keeps the
// vendor green and only brightens, because a white WhatsApp tab reads as a
// different service.
const pillBase =
  "group flex items-center rounded-l-full border shadow-lg outline-none transition-[filter,background-color,color] focus-visible:ring-2 focus-visible:ring-white";
const labelWrap =
  "max-w-0 overflow-hidden transition-[max-width] duration-300 ease-in-out group-hover:max-w-[16rem] group-focus-visible:max-w-[16rem] motion-reduce:transition-none";
const labelText = "block whitespace-nowrap pl-5 pr-2 text-sm font-semibold";
const iconWrap = "flex h-12 w-12 shrink-0 items-center justify-center";

export function QuickContact({
  whatsappUrl,
  quoteHref = "/contact",
}: QuickContactProps) {
  return (
    <div className="fixed right-0 top-[calc(var(--admin-banner-offset,0px)+10rem)] z-[60] flex flex-col items-end gap-3">
      {/* Request a Quote sits above WhatsApp: the quote is the outcome the site
          is for, and the top tab is the one a thumb reaches first. */}
      <Link
        href={quoteHref}
        aria-label="Request a Quote"
        title="Request a Quote"
        className={`${pillBase} border-gold bg-gold text-white hover:bg-white hover:text-gold`}
      >
        <span className={labelWrap}>
          <span className={labelText}>Request a Quote</span>
        </span>
        <span className={iconWrap}>
          <Icon data={iconData("chat")} className="h-6 w-6 shrink-0" />
        </span>
      </Link>

      {whatsappUrl ? (
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Contact Us On WhatsApp"
          title="Contact Us On WhatsApp"
          className={`${pillBase} border-whatsapp bg-whatsapp text-dark hover:brightness-110`}
        >
          <span className={labelWrap}>
            <span className={labelText}>Contact Us On WhatsApp</span>
          </span>
          <span className={iconWrap}>
            <Icon data={iconData("whatsapp")} className="h-6 w-6 shrink-0" />
          </span>
        </a>
      ) : null}
    </div>
  );
}
