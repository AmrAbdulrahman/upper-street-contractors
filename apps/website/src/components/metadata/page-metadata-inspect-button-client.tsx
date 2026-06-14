"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { pathnameToPageKey } from "@/helpers";
import { getPageMetaId } from "./get-page-meta-action";
import { MetadataInspectButton } from "./metadata-inspect-button";

type PageMetadataInspectButtonClientProps = {
  strapiUrl: string;
  siteMetaConfigId?: string | null;
};

export function PageMetadataInspectButtonClient({
  strapiUrl,
  siteMetaConfigId,
}: PageMetadataInspectButtonClientProps) {
  const pathname = usePathname();
  const [metaId, setMetaId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const key = pathnameToPageKey(pathname);

    void getPageMetaId(key).then((id) => {
      if (!cancelled) {
        setMetaId(id);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [pathname]);

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
