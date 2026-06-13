"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { pathnameToPageKey } from "@/helpers";
import { getPageMetaId } from "./get-page-meta-action";
import { MetadataInspectButton } from "./metadata-inspect-button";

type PageMetadataInspectButtonClientProps = {
  spaceId: string;
  environmentId: string;
};

export function PageMetadataInspectButtonClient({
  spaceId,
  environmentId,
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
