import type { SiteMetaConfigFragment } from "@/generated/graphql";

export function formatAddress(
  config: SiteMetaConfigFragment | null,
): string | null {
  if (!config?.addressLine) {
    return null;
  }

  const parts = [config.addressLine, config.city, config.postalCode].filter(
    Boolean,
  );

  return parts.length > 0 ? parts.join(", ") : null;
}
