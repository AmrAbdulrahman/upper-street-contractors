import { ICON_KEYS, type IconCode } from "@/components/ui/icon/types";

export function isIconCode(value: string): value is IconCode {
  return ICON_KEYS.includes(value as IconCode);
}
