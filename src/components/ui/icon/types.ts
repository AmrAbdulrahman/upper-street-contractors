export const ICON_KEYS = [
  "arrow-right",
  "chat",
  "check",
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

