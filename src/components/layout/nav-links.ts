export type NavLink = {
  label: string;
  href: string;
};

export const MAIN_NAV_LINKS: NavLink[] = [
  { label: "Home", href: "/" },
  { label: "Refurbishments", href: "/refurbishments" },
  { label: "Kitchens", href: "/kitchens" },
  { label: "Bathrooms", href: "/bathrooms" },
  { label: "Projects", href: "/projects" },
  { label: "About", href: "/about" },
  { label: "Contact", href: "/contact" },
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
