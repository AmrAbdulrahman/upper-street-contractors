export const ICON_KEYS = [
  "arrow-right",
  "chat",
  "shield",
  "star",
  "check",
  "whatsapp",
] as const;

export type IconCode = (typeof ICON_KEYS)[number];

export type IconSvgProps = {
  className?: string;
};

export function isIconCode(value: string): value is IconCode {
  return ICON_KEYS.includes(value as IconCode);
}
