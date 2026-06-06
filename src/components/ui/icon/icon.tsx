import type { ComponentType } from "react";
import { ChatIcon } from "./icons/chat";
import { CheckIcon } from "./icons/check";
import { ShieldIcon } from "./icons/shield";
import { StarIcon } from "./icons/star";
import { WhatsappIcon } from "./icons/whatsapp";
import type { IconCode, IconSvgProps } from "./types";
import { IconFragment } from "@/generated/graphql";

const iconMap: Record<IconCode, ComponentType<IconSvgProps>> = {
  chat: ChatIcon,
  shield: ShieldIcon,
  star: StarIcon,
  check: CheckIcon,
  whatsapp: WhatsappIcon,
};

export type IconProps = {
  data: IconFragment | null | undefined;
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
