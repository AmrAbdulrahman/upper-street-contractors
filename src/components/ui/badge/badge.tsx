import { isExternalHref } from "@/helpers";
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";

export const BADGE_VARIANTS = ["light", "dark"] as const;
export type BadgeVariant = (typeof BADGE_VARIANTS)[number];

const DEFAULT_RADIUS = 999;

export type BadgeProps = {
  variant?: BadgeVariant;
  radius?: number;
  href?: string;
  className?: string;
  children: ReactNode;
};

export function normalizeBadgeVariant(variant?: string | null): BadgeVariant {
  const key = variant?.trim().toLowerCase();

  if (key === "dark") return "dark";
  if (key === "light") return "light";

  return "light";
}

function resolveBadgeRadius(radius?: number | null): number {
  if (typeof radius === "number" && Number.isFinite(radius) && radius >= 0) {
    return radius;
  }

  return DEFAULT_RADIUS;
}

const variantClasses: Record<BadgeVariant, string> = {
  light: "bg-surface text-subtle",
  dark: "bg-dark text-white",
};

const baseClasses =
  "inline-flex items-center px-2.5 py-1 text-[11px] font-semibold leading-none";

export function Badge({
  variant = "light",
  radius,
  href,
  className,
  children,
}: BadgeProps) {
  const badgeVariant = normalizeBadgeVariant(variant);
  const style: CSSProperties = {
    borderRadius: resolveBadgeRadius(radius),
  };

  const classes = [baseClasses, variantClasses[badgeVariant], className]
    .filter(Boolean)
    .join(" ");

  if (href) {
    const external = isExternalHref(href);

    return (
      <Link
        href={href}
        className={`relative z-10 ${classes}`}
        style={style}
        target={external ? "_blank" : undefined}
        rel={external ? "noopener noreferrer" : undefined}
      >
        {children}
      </Link>
    );
  }

  return (
    <span className={classes} style={style}>
      {children}
    </span>
  );
}

export function badgePropsFromContentful(
  data:
    | {
        text?: string | null;
        variant?: string | null;
        href?: string | null;
        borderRadius?: number | null;
      }
    | null
    | undefined,
  options?: { href?: string | null; className?: string; stripHref?: boolean },
): BadgeProps | null {
  if (!data) {
    return null;
  }

  const text = data.text?.trim();

  if (!text) {
    return null;
  }

  const href =
    options?.stripHref || options?.href === null
      ? undefined
      : (options?.href ?? data.href ?? undefined);

  return {
    variant: normalizeBadgeVariant(data.variant),
    radius: resolveBadgeRadius(data.borderRadius),
    href,
    className: options?.className,
    children: text,
  };
}
