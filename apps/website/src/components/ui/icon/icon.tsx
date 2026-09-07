import type { ComponentType } from "react";
import { ArrowRightIcon } from "./icons/arrow-right";
import { ChatIcon } from "./icons/chat";
import { CheckIcon } from "./icons/check";
import { ChevronDownIcon } from "./icons/chevron-down";
import { EnvelopeIcon } from "./icons/envelope";
import { FacebookIcon } from "./icons/facebook";
import { InstagramIcon } from "./icons/instagram";
import { LinkedinIcon } from "./icons/linkedin";
import { PhoneIcon } from "./icons/phone";
import { PinIcon } from "./icons/pin";
import { ShieldIcon } from "./icons/shield";
import { StarIcon } from "./icons/star";
import { TiktokIcon } from "./icons/tiktok";
import { WhatsappIcon } from "./icons/whatsapp";
import { XIcon } from "./icons/x";
import type { IconCode, IconSvgProps } from "./types";

const iconMap: Record<IconCode, ComponentType<IconSvgProps>> = {
  "arrow-right": ArrowRightIcon,
  chat: ChatIcon,
  check: CheckIcon,
  "chevron-down": ChevronDownIcon,
  envelope: EnvelopeIcon,
  facebook: FacebookIcon,
  instagram: InstagramIcon,
  linkedin: LinkedinIcon,
  phone: PhoneIcon,
  pin: PinIcon,
  shield: ShieldIcon,
  star: StarIcon,
  tiktok: TiktokIcon,
  whatsapp: WhatsappIcon,
  x: XIcon,
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
