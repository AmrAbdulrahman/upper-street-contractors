import { headers } from "next/headers";
import { getPageMeta } from "./get-page-meta";
import { isContentfulInspectionEnabled } from "./is-contentful-inspection-enabled";
import { MetadataInspectButton } from "./metadata-inspect-button";
import { pathnameToPageKey } from "./page-key";

export async function PageMetadataInspectButton() {
  if (!(await isContentfulInspectionEnabled())) {
    return null;
  }

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
      spaceId={process.env.CONTENTFUL_SPACE_ID ?? ""}
      environmentId={process.env.CONTENTFUL_ENVIRONMENT ?? "master"}
    />
  );
}
