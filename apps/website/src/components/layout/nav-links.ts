export type NavLink = {
  label: string;
  href: string;
};

export function isNavLinkActive(pathname: string, href: string): boolean {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

// Horizontal padding is tighter below `xl` than it looks like it should be: the
// row carries ten `whitespace-nowrap shrink-0` items and cannot wrap (a
// variable-height header would fight the scroll-collapse hysteresis in
// `useScrolled`), so every px counts. Measured at 1024 — the width the desktop
// row first appears at — the ten items need ~868px of the ~929px available.
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
 * The header row. Nine trades plus Blog — the one non-service route here, kept
 * in the main row deliberately so the blog gets the prominence its search
 * traffic depends on. Note it therefore outranks /projects, which lives in the
 * footer only.
 */
export const MAIN_NAV_LINKS: NavLink[] = [
  { label: "Refurbishments", href: "/refurbishments" },
  { label: "Kitchens", href: "/kitchens" },
  { label: "Bathrooms", href: "/bathrooms" },
  { label: "Plumbing", href: "/plumbing" },
  { label: "Heating", href: "/heating" },
  { label: "Electric", href: "/electric" },
  { label: "Carpentry", href: "/carpentry" },
  { label: "Roofing", href: "/roofing" },
  { label: "Handyman", href: "/handyman" },
  { label: "Blog", href: "/blog" },
];

/**
 * The footer's Services column — every header nav link except Blog, which is a
 * content route and lives in {@link FOOTER_COMPANY_LINKS} instead.
 *
 * Derived from `MAIN_NAV_LINKS` rather than hand-listed so the two can't drift:
 * adding a trade to the header now adds it here. It replaced a curated set of
 * four (Bathroom Renovations / Kitchen Installations / Home Refurbishments /
 * Repairs & Smaller Works) whose labels and membership had diverged from the
 * header's nine.
 */
export const FOOTER_SERVICE_LINKS: NavLink[] = MAIN_NAV_LINKS.filter(
  (link) => link.href !== "/blog",
);

export const FOOTER_COMPANY_LINKS: NavLink[] = [
  { label: "About Us", href: "/about" },
  { label: "Projects", href: "/projects" },
  { label: "Blog", href: "/blog" },
  { label: "Contact", href: "/contact" },
  { label: "Rates", href: "/rates" },
];

export const FOOTER_LEGAL_LINKS: NavLink[] = [
  { label: "Privacy Policy", href: "/privacy-policy" },
  { label: "Terms & Conditions", href: "/terms-and-conditions" },
];
