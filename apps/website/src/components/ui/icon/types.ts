export const ICON_KEYS = [
  "arrow-right",
  "chat",
  // The footer's Social row. Each is the platform's own square brand mark,
  // matched to a `social-link`'s Platform value rather than typed by an editor.
  "facebook",
  "instagram",
  "linkedin",
  "tiktok",
  "x",
  "check",
  "chevron-down",
  "envelope",
  "phone",
  "pin",
  "shield",
  "star",
  "whatsapp",
] as const;

export type IconCode = (typeof ICON_KEYS)[number];

export type IconSvgProps = {
  className?: string;
};

