export type NavLink = {
  label: string;
  href: string;
  /**
   * Sub-links shown in a dropdown. Only `Services` has any: the nine trades used
   * to be the header row itself, which left no width for Home / Projects /
   * About / Contact.
   */
  children?: NavLink[];
};

export function isNavLinkActive(pathname: string, href: string): boolean {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Active state for a link that owns a dropdown: the parent lights up on its own
 * route *and* on any child's, so standing on `/kitchens` still shows `Services`
 * as where you are. Without this a visitor on a Service page sees nothing
 * selected in the header at all.
 */
export function isNavGroupActive(pathname: string, link: NavLink): boolean {
  if (isNavLinkActive(pathname, link.href)) {
    return true;
  }

  return (link.children ?? []).some((child) =>
    isNavLinkActive(pathname, child.href),
  );
}

// The padding stays tight even though the row is now six items rather than ten.
// It measured ~868px of the ~929px available at 1024 when the nine trades were
// all top-level; the Services dropdown bought that width back — and then the
// header put the brand lockup on the same line, which spent some of it again.
// The row is `whitespace-nowrap shrink-0` and never wraps.
const desktopNavLinkBaseClass =
  "whitespace-nowrap rounded-[8px] px-2 py-2 text-sm transition-colors xl:px-3 xl:text-[0.9375rem]";

export function getDesktopNavLinkClassName(isActive: boolean): string {
  return [
    desktopNavLinkBaseClass,
    isActive
      ? "text-gold font-semibold tracking-[0.5px] nav-link-selected"
      : "text-muted font-medium hover:bg-border-light/25 hover:text-dark",
  ].join(" ");
}

const mobileNavLinkBaseClass =
  "block rounded-md px-2 py-3 text-base transition-colors";

export function getMobileNavLinkClassName(isActive: boolean): string {
  return [
    mobileNavLinkBaseClass,
    isActive
      ? "text-gold font-bold nav-link-selected"
      : "text-muted font-medium hover:bg-border-light hover:text-dark",
  ].join(" ");
}

/**
 * The nine trades. Each is a Service page (`/<trade>`), and together they are
 * both the Services dropdown and the Services index's card grid — one list, so
 * the menu and `/services` cannot disagree about what we do.
 *
 * `Electric` (not Electrical) matches the route and the Category tag.
 */
export const SERVICE_LINKS: NavLink[] = [
  { label: "Refurbishments", href: "/refurbishments" },
  { label: "Kitchens", href: "/kitchens" },
  { label: "Bathrooms", href: "/bathrooms" },
  { label: "Plumbing", href: "/plumbing" },
  { label: "Heating", href: "/heating" },
  { label: "Electric", href: "/electric" },
  { label: "Carpentry", href: "/carpentry" },
  { label: "Roofing", href: "/roofing" },
  { label: "Handyman", href: "/handyman" },
];

/**
 * The header row. Six items: the nine trades collapsed into a Services
 * dropdown, which is what made room for Home, Projects, About Us and Contact —
 * none of which the header carried at all while the trades held the whole width.
 *
 * `Services` is a real link as well as a dropdown parent, so the row's own
 * label reaches the Services index rather than only ever opening a panel.
 *
 * Blog stays in the main row deliberately, for the prominence its search
 * traffic depends on.
 */
export const MAIN_NAV_LINKS: NavLink[] = [
  { label: "Home", href: "/" },
  { label: "Services", href: "/services", children: SERVICE_LINKS },
  { label: "Projects", href: "/projects" },
  { label: "Blog", href: "/blog" },
  { label: "About Us", href: "/about" },
  { label: "Contact", href: "/contact" },
];

/**
 * The footer no longer lists the nine trades. It carried a Services column
 * derived from the old ten-item header row; with the trades behind a dropdown
 * there is nothing to derive from, and repeating nine links in the footer of
 * every page was never what earned them their rankings.
 *
 * `Services` here is the hub: it links `/services`, which links all nine and is
 * in the sitemap. One extra hop, no orphans — and the header dropdown still
 * links every trade directly from every page.
 *
 * `Rates` is still not here. The route exists but has no content yet and is
 * noindexed, and a footer link is a promise that the destination answers the
 * question its label asks. Restore it when `/rates` carries the real rate card.
 */
export const FOOTER_COMPANY_LINKS: NavLink[] = [
  { label: "Services", href: "/services" },
  { label: "About Us", href: "/about" },
  { label: "Projects", href: "/projects" },
  { label: "Blog", href: "/blog" },
  { label: "Contact", href: "/contact" },
];

export const FOOTER_LEGAL_LINKS: NavLink[] = [
  { label: "Privacy Policy", href: "/privacy-policy" },
  { label: "Terms & Conditions", href: "/terms-and-conditions" },
];
