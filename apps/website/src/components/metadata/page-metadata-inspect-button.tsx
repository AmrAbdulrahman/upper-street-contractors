import { headers } from "next/headers";
import { getPageMeta } from "./get-page-meta";
import {
  isStrapiInspectionBuildEnabled,
  isStrapiInspectionEnabled,
} from "./is-strapi-inspection-enabled";
import { MetadataInspectButton } from "./metadata-inspect-button";
import { PageMetadataInspectButtonClient } from "./page-metadata-inspect-button-client";
import { pathnameToPageKey } from "@/helpers";
import { getSiteMetaConfig } from "@/components/site-meta-config";

export async function PageMetadataInspectButton() {
  if (!isStrapiInspectionBuildEnabled()) {
    return null;
  }

  if (!(await isStrapiInspectionEnabled())) {
    return null;
  }

  const strapiUrl = process.env.NEXT_PUBLIC_STRAPI_URL ?? "http://localhost:1337";
  const siteMetaConfig = await getSiteMetaConfig();
  const siteMetaConfigId = siteMetaConfig?.documentId ?? null;

  if (process.env.ENABLE_PREVIEW === "true") {
    const headersList = await headers();
    const pathname = headersList.get("x-pathname") ?? "/";
    const key = pathnameToPageKey(pathname);
    const metaId = await getPageMeta(key);

    if (!metaId && !siteMetaConfigId) {
      return null;
    }

    return (
      <MetadataInspectButton
        metaId={metaId ?? ""}
        siteMetaConfigId={siteMetaConfigId}
        strapiUrl={strapiUrl}
      />
    );
  }

  return (
    <PageMetadataInspectButtonClient
      strapiUrl={strapiUrl}
      siteMetaConfigId={siteMetaConfigId}
    />
  );
}
