import type { SiteMetaConfigFragment } from "@/generated/graphql";
import { getWhatsAppUrl } from "@/helpers/whatsapp-url";

export function resolveWhatsAppUrl(
  config: SiteMetaConfigFragment | null,
): string | null {
  const socialWhatsapp = config?.socialLinks?.find((item) =>
    item?.socialNetworkName?.toLowerCase().includes("whatsapp"),
  )?.url;

  if (socialWhatsapp) {
    return socialWhatsapp;
  }

  if (config?.phoneNumber) {
    return getWhatsAppUrl(config.phoneNumber);
  }

  return null;
}
