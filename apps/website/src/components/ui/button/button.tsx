import { Icon } from "@/components/ui/icon";
import {
  BUTTON_ACTIONS,
  BUTTON_COLORS,
  BUTTON_VARIANTS,
  CONTACT_FORM_PATH,
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
import { ButtonFragment } from "@/generated/graphql";
import Link from "next/link";
import { type CSSProperties } from "react";

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

// `gold` on white is 4.74:1 — over the 4.5:1 AA floor, so white label text is
// safe on the filled variant. The text variant deliberately uses `gold-deep`
// (#7a5a2b) instead: gold as *text* on a light surface is only ~4.7:1 at best
// and drops below AA on the cream `surface`, where most of these sit.
const buttonStyles: Record<ButtonVariant, Record<ButtonColor, string>> = {
  contained: {
    green: "bg-whatsapp text-dark hover:brightness-110",
    // Navy inverts to gold, the way the gold one inverts to white: both
    // primaries answer a hover with a real change of colour rather than the 10%
    // tint nobody could see. `gold-mid`, not `gold`: the label goes navy on the
    // fill, and navy on the primary gold is 3.97:1 — under the 4.5:1 AA floor
    // for a 16px semibold label. On `gold-mid` it is 6.6:1.
    dark_blue: "border border-dark bg-dark text-white hover:border-gold-mid hover:bg-gold-mid hover:text-dark",
    white: "border border-border bg-white text-dark hover:bg-border-light",
    black: "bg-dark-2 text-white hover:bg-dark-2/90",
    // Hover inverts to white-on-gold. The border is load-bearing, not
    // decoration: without it the button vanishes into the white and cream
    // sections most of these sit on the moment a pointer touches it. Gold text
    // on white is 4.9:1, over the AA floor for the bold >=14px label — which is
    // why it is `gold` here and not `gold-mid`, which is not.
    gold: "border border-gold bg-gold text-white hover:bg-white hover:text-gold",
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
    gold:
      "border-2 border-gold bg-transparent text-gold-deep hover:bg-gold/10",
  },
  text: {
    green: "bg-transparent text-whatsapp hover:bg-whatsapp/10",
    dark_blue: "bg-transparent text-dark hover:bg-dark/5",
    white: "bg-transparent text-white hover:bg-white/10",
    black: "bg-transparent text-dark hover:bg-dark/5",
    gold: "bg-transparent text-gold-deep hover:bg-gold/10",
  },
};

/**
 * Turn a CMS `action` into a real destination.
 *
 * A Button carries either an explicit `href` or an `action`, and until now only
 * the first actually went anywhere: an action-only Button rendered a `<button>`
 * whose click handler logged to the console. The home hero's "Request a Free
 * Quote" is exactly that shape, which is why it did nothing at all.
 *
 * `href` still wins when both are set — an editor who typed a URL meant it.
 *
 * There is one action left. The `whatsapp` one was removed along with every
 * WhatsApp button on the site: the pinned Quick Contact tab is the single
 * affordance now, so a CMS Button has no WhatsApp destination to resolve to.
 */
function resolveActionHref(action: ButtonAction | undefined): string | null {
  if (!action) return null;
  return action === "contact_form" ? CONTACT_FORM_PATH : null;
}

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
  icon?: { code?: string | null } | null;
  iconPosition: IconPosition;
}) {
  const iconElement = <Icon data={icon} className="h-4 w-4 shrink-0" />;

  return (
    <>
      {iconPosition === "start" ? iconElement : null}
      {label}
      {iconPosition === "end" ? iconElement : null}
    </>
  );
}

function resolveButtonBorderRadius(value: unknown): number | undefined {
  const radius = typeof value === "number" ? value : Number(value);
  return Number.isFinite(radius) ? radius : undefined;
}

/**
 * A CMS Button. Always a link — there is no on-page behaviour a Button can have
 * that isn't "go somewhere", so the `<button disabled>` branch this used to fall
 * back to only ever meant "this entry is incomplete", rendered as a control the
 * visitor could tab to and get nothing from.
 *
 * A Button with nothing to click, or nothing to read, renders **nothing**. An
 * unfinished CMS entry should be invisible on the public site, not a dead
 * control captioned "N/A" (there is one of those published right now).
 */
export function Button({ data, className }: ButtonProps) {
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
  const buttonAction = normalizeButtonAction(action);
  const resolvedHref = href || resolveActionHref(buttonAction);
  const trimmedLabel = label?.trim() || null;

  // Nowhere to go, or nothing to read: render nothing at all. A label is not
  // optional — an icon alone leaves the link with no accessible name, and every
  // Button the CMS actually holds has one.
  if (!resolvedHref || !trimmedLabel) return null;

  const borderRadius = resolveButtonBorderRadius(rawBorderRadius);
  const buttonVariant = normalizeButtonVariant(variant);
  const buttonColor = normalizeButtonColor(color);
  const buttonIconPosition = normalizeIconPosition(iconPosition);
  const classes = getButtonClasses(buttonVariant, buttonColor, className);
  const style = getButtonStyle(buttonVariant, buttonColor, borderRadius);
  const external = isExternalHref(resolvedHref);

  return (
    <Link
      href={resolvedHref}
      className={classes}
      style={style}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
    >
      <ButtonContent
        label={trimmedLabel}
        icon={icon}
        iconPosition={buttonIconPosition}
      />
    </Link>
  );
}
