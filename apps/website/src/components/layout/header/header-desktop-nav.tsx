"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  getDesktopNavLinkClassName,
  isNavLinkActive,
  type NavLink,
} from "@/components/layout/nav-links";
import { HeaderServicesMenu } from "@/components/layout/header/header-services-menu";

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
      {/*
        gap-2 / xl:gap-4 dates from the ten-item row, where gap-4 / xl:gap-6
        overflowed: at 1024 the items spilled past the viewport on BOTH sides
        and at xl they broke out of the max-w-container gutters. Six items
        sharing a line with the brand lockup have room to spare, but the row is
        still `whitespace-nowrap shrink-0` and still never wraps, so the slack
        stays banked rather than spent.

        `justify-end`, not the old `justify-center`: the nav no longer owns a
        row of its own — it sits to the right of the lockup.
      */}
      <ul className="flex items-center justify-end gap-2 xl:gap-4">
        {links.map((link) => {
          if (link.children?.length) {
            return <HeaderServicesMenu key={link.href} link={link} />;
          }

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
