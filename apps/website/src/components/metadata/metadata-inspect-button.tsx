"use client";

const PAGE_META_TOOLTIP = "Edit this page's meta data";
const SITE_META_TOOLTIP = "Edit global site meta config";

export type MetadataInspectButtonProps = {
  metaId: string;
  siteMetaConfigId?: string | null;
  strapiUrl?: string;
  placement?: "floating" | "banner";
};

export function MetadataInspectButton({
  metaId,
  siteMetaConfigId,
  strapiUrl = process.env.NEXT_PUBLIC_STRAPI_URL ?? "http://localhost:1337",
  placement = "floating",
}: MetadataInspectButtonProps) {
  // const { enabled } = useStrapiInspection();

  // if (!enabled) {
  //   return null;
  // }

  if (!metaId && !siteMetaConfigId) {
    return null;
  }

  // const pageMetaUrl = metaId
  //   ? buildStrapiEntryUrl({
  //       strapiUrl,
  //       documentId: metaId,
  //       typename: "MetaData",
  //     })
  //   : null;

  // const siteMetaUrl = siteMetaConfigId
  //   ? buildStrapiEntryUrl({
  //       strapiUrl,
  //       documentId: siteMetaConfigId,
  //       typename: "SiteMetaConfig",
  //     })
  //   : null;

  const floatingButtonClassName =
    "group fixed z-60 flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border-2 border-dashed border-gold bg-transparent shadow-[0_8px_28px_rgba(27,38,56,0.38),0_0_20px_rgba(184,134,58,0.7),0_0_40px_rgba(184,134,58,0.3)] transition-[border-color,box-shadow] hover:border-gold-mid hover:shadow-[0_10px_36px_rgba(27,38,56,0.45),0_0_28px_rgba(184,134,58,0.85),0_0_56px_rgba(184,134,58,0.4)]";

  const floatingTooltipClassName =
    "pointer-events-none absolute left-full top-1/2 ml-2 -translate-y-1/2 whitespace-nowrap rounded-md border-2 border-gold bg-transparent px-2.5 py-1.5 text-xs font-medium text-gold opacity-0 shadow-[0_10px_36px_rgba(27,38,56,0.45),0_0_28px_rgba(184,134,58,0.85),0_0_56px_rgba(184,134,58,0.4)] transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100";

  const bannerLinkClassName =
    "inline-flex h-7 items-center rounded-md border border-white/60 px-3 text-xs font-semibold text-white transition-colors hover:bg-white/15";

  if (placement === "banner") {
    return (
      <>
        {/* {siteMetaUrl ? (
          <a
            href={siteMetaUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={bannerLinkClassName}
          >
            Site meta
          </a>
        ) : null}

        {pageMetaUrl ? (
          <a
            href={pageMetaUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={bannerLinkClassName}
          >
            Page meta
          </a>
        ) : null} */}
      </>
    );
  }

  return (
    <div className="fixed left-4 top-[calc(var(--admin-banner-offset,0px)+1rem)] z-60 flex flex-col gap-2">
      {/* {pageMetaUrl ? (
        <a
          href={pageMetaUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={PAGE_META_TOOLTIP}
          title={PAGE_META_TOOLTIP}
          className={floatingButtonClassName}
        >
          <span aria-hidden="true" className="text-lg leading-none">
            ⚙️
          </span>
          <span role="tooltip" className={floatingTooltipClassName}>
            {PAGE_META_TOOLTIP}
          </span>
        </a>
      ) : null} */}

      {/* {siteMetaUrl ? (
        <a
          href={siteMetaUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={SITE_META_TOOLTIP}
          title={SITE_META_TOOLTIP}
          className={floatingButtonClassName}
        >
          <span aria-hidden="true" className="text-lg leading-none">
            🌐
          </span>
          <span role="tooltip" className={floatingTooltipClassName}>
            {SITE_META_TOOLTIP}
          </span>
        </a>
      ) : null} */}
      TODO
    </div>
  );
}
