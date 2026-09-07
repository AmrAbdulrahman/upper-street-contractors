"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  getDesktopNavLinkClassName,
  isNavGroupActive,
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
        {/*
          Every item is a plain link. `Services` had a dropdown of the nine
          trades hanging off a chevron beside it; it is gone, and the Services
          index it linked is the one place that lists them — a page that has
          always existed, is in the sitemap, and shows each service as a card
          with a photo rather than a line of text in a panel.

          `isNavGroupActive`, not `isNavLinkActive`: a visitor standing on
          `/kitchens` must still see `Services` lit in the header, and that is
          what the `children` on the nav model are still for now that nothing
          renders them.
        */}
        {links.map((link) => {
          const isActive = isNavGroupActive(pathname, link);

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
