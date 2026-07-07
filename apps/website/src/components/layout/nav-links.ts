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

const desktopNavLinkBaseClass =
  "whitespace-nowrap rounded-[8px] px-2.5 py-2 text-sm transition-colors xl:px-3 xl:text-[0.9375rem]";

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
];

export const FOOTER_SERVICE_LINKS: NavLink[] = [
  { label: "Bathroom Renovations", href: "/bathrooms" },
  { label: "Kitchen Installations", href: "/kitchens" },
  { label: "Home Refurbishments", href: "/refurbishments" },
  { label: "Repairs & Smaller Works", href: "/repairs-and-smaller-works" },
];

export const FOOTER_COMPANY_LINKS: NavLink[] = [
  { label: "About Us", href: "/about" },
  { label: "Projects", href: "/projects" },
  { label: "Contact", href: "/contact" },
  { label: "Rates", href: "/rates" },
];
