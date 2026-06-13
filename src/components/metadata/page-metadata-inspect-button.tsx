import { headers } from "next/headers";
import { getPageMeta } from "./get-page-meta";
import {
  isContentfulInspectionBuildEnabled,
  isContentfulInspectionEnabled,
} from "./is-contentful-inspection-enabled";
import { MetadataInspectButton } from "./metadata-inspect-button";
import { PageMetadataInspectButtonClient } from "./page-metadata-inspect-button-client";
import { pathnameToPageKey } from "@/helpers";

export async function PageMetadataInspectButton() {
  if (!isContentfulInspectionBuildEnabled()) {
    return null;
  }

  if (!(await isContentfulInspectionEnabled())) {
    return null;
  }

  const spaceId = process.env.CONTENTFUL_SPACE_ID ?? "";
  const environmentId = process.env.CONTENTFUL_ENVIRONMENT ?? "master";

  if (process.env.CONTENTFUL_PREVIEW === "true") {
    const headersList = await headers();
    const pathname = headersList.get("x-pathname") ?? "/";
    const key = pathnameToPageKey(pathname);
    const metaId = await getPageMeta(key);

    if (!metaId) {
      return null;
    }

    return (
      <MetadataInspectButton
        metaId={metaId}
        spaceId={spaceId}
        environmentId={environmentId}
      />
    );
  }

  return (
    <PageMetadataInspectButtonClient
      spaceId={spaceId}
      environmentId={environmentId}
    />
  );
}
