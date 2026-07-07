import type { ComponentType } from "react";
import { ArrowRightIcon } from "./icons/arrow-right";
import { ChatIcon } from "./icons/chat";
import { CheckIcon } from "./icons/check";
import { EnvelopeIcon } from "./icons/envelope";
import { PhoneIcon } from "./icons/phone";
import { PinIcon } from "./icons/pin";
import { ShieldIcon } from "./icons/shield";
import { StarIcon } from "./icons/star";
import { WhatsappIcon } from "./icons/whatsapp";
import type { IconCode, IconSvgProps } from "./types";

const iconMap: Record<IconCode, ComponentType<IconSvgProps>> = {
  "arrow-right": ArrowRightIcon,
  chat: ChatIcon,
  check: CheckIcon,
  envelope: EnvelopeIcon,
  phone: PhoneIcon,
  pin: PinIcon,
  shield: ShieldIcon,
  star: StarIcon,
  whatsapp: WhatsappIcon,
};

export type IconProps = {
  data: { code?: string | null } | null | undefined;
  className?: string;
};

export function Icon({ data, className = "h-5 w-5 shrink-0" }: IconProps) {
  if (!data) {
    return null;
  }

  const { code } = data;

  if (!code) {
    return null;
  }

  const IconComponent = iconMap[code as IconCode];
  return <IconComponent className={className} />;
}
