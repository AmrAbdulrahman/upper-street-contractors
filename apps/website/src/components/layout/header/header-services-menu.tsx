"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import {
  getDesktopNavLinkClassName,
  isNavGroupActive,
  isNavLinkActive,
  type NavLink,
} from "@/components/layout/nav-links";
import { Icon } from "@/components/ui/icon";
import { iconData } from "@/helpers";

type HeaderServicesMenuProps = {
  link: NavLink;
};

/**
 * A nav item that is a link *and* a dropdown parent.
 *
 * The label and the disclosure are two separate controls on purpose. Making the
 * whole item the toggle would mean "Services" no longer reaches the Services
 * index, and making it hover-only would mean a touch visitor can never see the
 * panel at all — a tap on a link navigates, it does not hover. So: the label is
 * a real `<Link>`, and a sibling `<button aria-expanded>` opens the panel by
 * click, by Enter/Space, or by hover for anyone driving a mouse.
 *
 * The panel is absolutely positioned and never in flow — the header is one
 * fixed-height row, and a panel that pushed it taller would move the page under
 * the pointer that opened it.
 */
export function HeaderServicesMenu({ link }: HeaderServicesMenuProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const containerRef = useRef<HTMLLIElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  const children = link.children ?? [];
  const isActive = isNavGroupActive(pathname, link);

  const close = useCallback(() => setOpen(false), []);

  // Navigating from inside the panel should not leave it hanging open over the
  // page it just moved to. Adjusted during render rather than in an effect:
  // React re-runs this component before committing, so the panel never paints
  // open on the new route — an effect would show one frame of it and cost a
  // second render.
  const [renderedPath, setRenderedPath] = useState(pathname);
  if (renderedPath !== pathname) {
    setRenderedPath(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        close();
        // Escape must land focus somewhere predictable, and the control that
        // opened the panel is the only place that qualifies.
        toggleRef.current?.focus();
      }
    };

    // `mousedown`, not `click`: a click on a link inside the panel would
    // otherwise race the navigation.
    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target;

      if (target instanceof Node && containerRef.current?.contains(target)) {
        return;
      }

      close();
    };

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
    };
  }, [close, open]);

  return (
    <li
      ref={containerRef}
      className="relative shrink-0"
      // Mouse only. A touch tap fires `pointerenter` too, which would open the
      // panel underneath the navigation the same tap is already performing.
      onPointerEnter={(event) => {
        if (event.pointerType === "mouse") {
          setOpen(true);
        }
      }}
      onPointerLeave={(event) => {
        if (event.pointerType === "mouse") {
          setOpen(false);
        }
      }}
      // Deliberately NO onFocus-to-open. It was here, and it fought Escape:
      // closing returns focus to the chevron, the chevron is inside this group,
      // so focusin fired and reopened the panel a frame later — Escape looked
      // like it did nothing. A disclosure button IS the keyboard affordance, so
      // a keyboard visitor opens it with Enter/Space and nothing has to guess.
      //
      // onBlur stays: React's is focusout, so tabbing past the last link in the
      // panel closes it behind you.
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setOpen(false);
        }
      }}
    >
      <span className="flex items-center">
        <Link
          href={link.href}
          className={getDesktopNavLinkClassName(isActive)}
          aria-current={isActive ? "page" : undefined}
        >
          {link.label}
        </Link>

        <button
          ref={toggleRef}
          type="button"
          aria-expanded={open}
          aria-controls={menuId}
          aria-label={`${open ? "Hide" : "Show"} ${link.label.toLowerCase()} menu`}
          onClick={() => setOpen((value) => !value)}
          className="-ml-1 inline-flex h-7 w-6 items-center justify-center rounded-[8px] text-muted transition-colors hover:bg-border-light/25 hover:text-dark"
        >
          <Icon
            data={iconData("chevron-down")}
            className={`h-3.5 w-3.5 shrink-0 transition-transform duration-200 motion-reduce:transition-none ${
              open ? "rotate-180" : ""
            }`}
          />
        </button>
      </span>

      {open ? (
        <div
          id={menuId}
          className="absolute top-full left-1/2 z-50 mt-1.5 w-[26rem] -translate-x-1/2 rounded-xl border border-border bg-white p-2 shadow-lg"
        >
          <ul className="grid grid-cols-2 gap-x-1">
            {children.map((child) => {
              const isChildActive = isNavLinkActive(pathname, child.href);

              return (
                <li key={child.href}>
                  <Link
                    href={child.href}
                    className={`block rounded-md px-3 py-2 text-sm transition-colors ${
                      isChildActive
                        ? "text-gold font-semibold nav-link-selected"
                        : "text-muted font-medium hover:bg-border-light/40 hover:text-dark"
                    }`}
                    aria-current={isChildActive ? "page" : undefined}
                  >
                    {child.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </li>
  );
}
