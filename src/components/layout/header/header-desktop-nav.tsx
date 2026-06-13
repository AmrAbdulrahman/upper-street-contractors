"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  getDesktopNavLinkClassName,
  isNavLinkActive,
  type NavLink,
} from "@/components/layout/nav-links";

type HeaderDesktopNavProps = {
  links: NavLink[];
};

export function HeaderDesktopNav({ links }: HeaderDesktopNavProps) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Main navigation"
      className="min-w-0"
    >
      <ul className="flex items-center justify-center gap-4 xl:gap-6">
        {links.map((link) => {
          const isActive = isNavLinkActive(pathname, link.href);

          return (
            <li key={link.href} className="shrink-0">
              <Link
                href={link.href}
                className={getDesktopNavLinkClassName(isActive)}
                aria-current={isActive ? "page" : undefined}
              >
                {link.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
