"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useState } from "react";
import {
  getMobileNavLinkClassName,
  isNavLinkActive,
  type NavLink,
} from "@/components/layout/nav-links";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { iconData } from "@/helpers";

type HeaderMobileNavProps = {
  links: NavLink[];
  whatsappUrl: string | null;
};

const quoteButtonClass =
  "inline-flex h-11 w-full items-center justify-center rounded-full border border-border bg-white px-5 text-sm font-semibold text-dark transition-colors hover:bg-border-light";

const whatsappButtonClass =
  "inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-whatsapp px-5 text-sm font-semibold text-white transition-[filter] hover:brightness-110";

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

export function HeaderMobileNav({ links, whatsappUrl }: HeaderMobileNavProps) {
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
              {links.map((link) => {
                const isActive = isNavLinkActive(pathname, link.href);

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
              <Link href="/contact" className={quoteButtonClass} onClick={close}>
                Request a Quote
              </Link>
              {whatsappUrl ? (
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={whatsappButtonClass}
                  onClick={close}
                >
                  <Icon data={iconData("whatsapp")} className="h-4 w-4 shrink-0" />
                  WhatsApp
                </a>
              ) : null}
            </div>
          </nav>
        </>
      ) : null}
    </div>
  );
}
