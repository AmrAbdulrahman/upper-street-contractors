/**
 * Where a `contact_form` Button action goes. One constant rather than a literal
 * per call site, because the enquiry route is about to start carrying a source
 * service in its query string and every producer of that link has to agree.
 */
export const CONTACT_FORM_PATH = "/contact";

export const BUTTON_VARIANTS = ["contained", "outlined", "text"] as const;
// `gold` is the brand colour and the one the primary CTA wears. It sits last
// because the earlier four are stored values in live CMS entries and the order
// is what the type-builder shows an editor.
export const BUTTON_COLORS = [
  "green",
  "dark_blue",
  "white",
  "black",
  "gold",
] as const;
export const BUTTON_ACTIONS = ["whatsapp", "contact_form"] as const;
export const ICON_POSITIONS = ["start", "end"] as const;

export type ButtonVariant = (typeof BUTTON_VARIANTS)[number];
export type ButtonColor = (typeof BUTTON_COLORS)[number];
export type ButtonAction = (typeof BUTTON_ACTIONS)[number];
export type IconPosition = (typeof ICON_POSITIONS)[number];

export function normalizeButtonVariant(variant?: string | null): ButtonVariant {
  const key = variant?.toLowerCase();

  if (key === "contained" || key === "primary" || key === "solid" || key === "filled") {
    return "contained";
  }

  if (key === "outlined" || key === "outline" || key === "secondary") {
    return "outlined";
  }

  if (key === "text" || key === "ghost" || key === "link") {
    return "text";
  }

  return "contained";
}

export function normalizeButtonColor(color?: string | null): ButtonColor {
  const key = color?.toLowerCase().replace(/_/g, "-");

  if (key === "green") return "green";
  if (key === "dark-blue" || key === "dark" || key === "dark_blue") return "dark_blue";
  if (key === "white") return "white";
  if (key === "black") return "black";
  if (key === "gold" || key === "brand" || key === "primary") return "gold";

  return "green";
}

export function normalizeButtonAction(
  action?: string | null,
): ButtonAction | undefined {
  const key = action?.toLowerCase().replace(/_/g, "-");

  if (key === "whatsapp") return "whatsapp";
  if (key === "contact-form" || key === "contact_form") return "contact_form";

  return undefined;
}

export function normalizeIconPosition(
  position?: string | null,
): IconPosition {
  const key = position?.trim().toLowerCase();

  if (
    key === "end" ||
    key === "right" ||
    key === "trailing" ||
    key === "after" ||
    key === "after text"
  ) {
    return "end";
  }

  return "start";
}

export function isExternalHref(href: string): boolean {
  return /^https?:\/\//i.test(href) || href.startsWith("//");
}
