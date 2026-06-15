'use client';

import { Icon } from "@/components/ui/icon";
import {
  BUTTON_ACTIONS,
  BUTTON_COLORS,
  BUTTON_VARIANTS,
  ICON_POSITIONS,
  isExternalHref,
  normalizeButtonAction,
  normalizeButtonColor,
  normalizeButtonVariant,
  normalizeIconPosition,
  type ButtonAction,
  type ButtonColor,
  type ButtonVariant,
  type IconPosition,
} from "@/helpers";
import { ButtonFragment, IconFragment } from "@/generated/graphql";
import Link from "next/link";
import { forwardRef, type CSSProperties, type ForwardedRef } from "react";

export {
  BUTTON_ACTIONS,
  BUTTON_COLORS,
  BUTTON_VARIANTS,
  ICON_POSITIONS,
  isExternalHref,
  normalizeButtonAction,
  normalizeButtonColor,
  normalizeButtonVariant,
  normalizeIconPosition,
  type ButtonAction,
  type ButtonColor,
  type ButtonVariant,
  type IconPosition,
};

const DEFAULT_BORDER_RADIUS = 8;

const baseClasses =
  "inline-flex h-12 cursor-pointer items-center justify-center gap-2 px-6 text-base font-semibold transition-colors disabled:cursor-not-allowed";

const buttonStyles: Record<ButtonVariant, Record<ButtonColor, string>> = {
  contained: {
    green: "bg-whatsapp text-white hover:brightness-110",
    dark_blue: "bg-dark text-white hover:bg-dark/90",
    white: "border border-border bg-white text-dark hover:bg-border-light",
    black: "bg-dark-2 text-white hover:bg-dark-2/90",
  },
  outlined: {
    green:
      "border border-whatsapp bg-transparent text-whatsapp hover:bg-whatsapp/10",
    dark_blue:
      "border border-dark bg-transparent text-dark hover:bg-dark/5",
    white:
      "border border-white/35 bg-transparent text-white hover:border-white/50 hover:bg-white/5",
    black:
      "border-2 border-dark bg-surface text-dark hover:bg-border-light",
  },
  text: {
    green: "bg-transparent text-whatsapp hover:bg-whatsapp/10",
    dark_blue: "bg-transparent text-dark hover:bg-dark/5",
    white: "bg-transparent text-white hover:bg-white/10",
    black: "bg-transparent text-dark hover:bg-dark/5",
  },
};

const actionHandlers: Record<ButtonAction, () => void> = {
  whatsapp: () => {
    console.log("[Button] WhatsApp action — replace with wa.me link or deep link");
  },
  contact_form: () => {
    console.log("[Button] Contact action — replace with navigation to contact form");
  },
};

export type ButtonData = Partial<
  Pick<
    ButtonFragment,
    | "action"
    | "borderRadius"
    | "color"
    | "href"
    | "icon"
    | "iconPosition"
    | "label"
    | "variant"
  >
>;

export type ButtonProps = {
  data: ButtonData;
  className?: string;
};

function getDefaultBorderRadius(
  variant: ButtonVariant,
  color: ButtonColor,
): number {
  if (variant === "contained" && (color === "green" || color === "white")) {
    return 9999;
  }

  return 12;
}

function getButtonClasses(
  variant: ButtonVariant,
  color: ButtonColor,
  className?: string,
) {
  return [baseClasses, buttonStyles[variant][color], className]
    .filter(Boolean)
    .join(" ");
}

function getButtonStyle(
  variant: ButtonVariant,
  color: ButtonColor,
  borderRadius?: number | null,
): CSSProperties {
  return {
    borderRadius:
      borderRadius ?? getDefaultBorderRadius(variant, color) ?? DEFAULT_BORDER_RADIUS,
  };
}

function ButtonContent({
  label,
  icon,
  iconPosition,
}: {
  label: string | null;
  icon?: IconFragment | null;
  iconPosition: IconPosition;
}) {
  const iconElement = <Icon data={icon} className="h-4 w-4 shrink-0" />;

  return (
    <>
      {iconPosition === "start" ? iconElement : null}
      {label ?? "N/A"}
      {iconPosition === "end" ? iconElement : null}
    </>
  );
}

function resolveButtonBorderRadius(value: unknown): number | undefined {
  const radius = typeof value === "number" ? value : Number(value);
  return Number.isFinite(radius) ? radius : undefined;
}

export const Button = forwardRef<
  HTMLButtonElement | HTMLAnchorElement,
  ButtonProps
>(function Button(
  {
    data,
    className,
  },
  ref,
) {
  const {
    borderRadius: rawBorderRadius,
    variant,
    color,
    action,
    href,
    iconPosition,
    label = "",
    icon,
  } = data;
  const borderRadius = resolveButtonBorderRadius(rawBorderRadius);
  const buttonVariant = normalizeButtonVariant(variant);
  const buttonColor = normalizeButtonColor(color);
  const buttonAction = normalizeButtonAction(action);
  const buttonIconPosition = normalizeIconPosition(iconPosition);
  const classes = getButtonClasses(buttonVariant, buttonColor, className);
  const style = getButtonStyle(buttonVariant, buttonColor, borderRadius);
  const content = (
    <ButtonContent
      label={label}
      icon={icon}
      iconPosition={buttonIconPosition}
    />
  );

  if (href) {
    const external = isExternalHref(href);

    return (
      <Link
        ref={ref as ForwardedRef<HTMLAnchorElement>}
        href={href}
        className={classes}
        style={style}
        target={external ? "_blank" : undefined}
        rel={external ? "noopener noreferrer" : undefined}
      >
        {content}
      </Link>
    );
  }

  return (
    <button
      ref={ref as ForwardedRef<HTMLButtonElement>}
      type="button"
      className={classes}
      style={style}
      onClick={buttonAction ? () => actionHandlers[buttonAction]() : undefined}
      disabled={!buttonAction}
    >
      {content}
    </button>
  );
});
