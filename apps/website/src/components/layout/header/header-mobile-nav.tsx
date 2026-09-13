"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useState } from "react";
import {
  getMobileNavLinkClassName,
  isNavGroupActive,
  type NavLink,
} from "@/components/layout/nav-links";
import { usePathname } from "next/navigation";

type HeaderMobileNavProps = {
  links: NavLink[];
};

// Gold fill, not the old white-on-white outline: this is the primary CTA of the
// whole site and it was the quieter of the two buttons in the mobile menu.
const quoteButtonClass =
  "inline-flex h-11 w-full items-center justify-center rounded-full border border-gold bg-gold px-5 text-sm font-semibold text-white transition-colors hover:bg-white hover:text-gold";

function MenuIcon() {
  return (
    <svg
      aria-hidden
      className="h-5 w-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      aria-hidden
      className="h-5 w-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

export function HeaderMobileNav({ links }: HeaderMobileNavProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const menuId = useId();

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        close();
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [close, open]);

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={open ? "Close menu" : "Open menu"}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-border text-dark transition-colors hover:bg-border-light"
      >
        {open ? <CloseIcon /> : <MenuIcon />}
      </button>

      {open ? (
        <>
          <button
            type="button"
            aria-label="Close menu"
            className="fixed inset-0 z-30 bg-dark/20"
            onClick={close}
          />

          <nav
            id={menuId}
            aria-label="Main navigation"
            className="absolute right-0 z-40 mt-3 w-[min(100vw-3rem,20rem)] rounded-xl border border-border bg-white p-4 shadow-lg"
          >
            <ul>
              {/*
                Every item is a plain link, exactly as on desktop. `Services`
                used to be a native <details> accordion of the nine trades with
                an "All services" row beneath it: tapping the label opened a
                panel rather than going anywhere, so one label did two different
                things depending on which breakpoint you were on. It now
                navigates to the Services index — the page that lists all nine
                as cards with photos, and the one place they are maintained.

                `isNavGroupActive`, not `isNavLinkActive`: a visitor standing on
                `/kitchens` must still see `Services` lit, and that is the only
                thing the `children` on the nav model are for now that neither
                nav renders them.
              */}
              {links.map((link) => {
                const isActive = isNavGroupActive(pathname, link);

                return (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className={getMobileNavLinkClassName(isActive)}
                      aria-current={isActive ? "page" : undefined}
                      onClick={close}
                    >
                      {link.label}
                    </Link>
                  </li>
                );
              })}
            </ul>

            <div className="mt-2 flex flex-col gap-3 border-t border-border-light pt-4">
              {/* The menu's WhatsApp button is gone: the Quick Contact tab is
                  pinned to this page too, so the menu was offering a second
                  route to the same conversation. */}
              <Link href="/contact" className={quoteButtonClass} onClick={close}>
                Request a Quote
              </Link>
            </div>
          </nav>
        </>
      ) : null}
    </div>
  );
}
