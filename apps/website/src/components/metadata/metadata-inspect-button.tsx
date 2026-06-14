import { buildStrapiEntryUrl } from "@/helpers/strapi-entry-url";

const PAGE_META_TOOLTIP = "Edit this page's meta data";
const SITE_META_TOOLTIP = "Edit global site meta config";

export type MetadataInspectButtonProps = {
  metaId: string;
  siteMetaConfigId?: string | null;
  strapiUrl?: string;
};

export function MetadataInspectButton({
  metaId,
  siteMetaConfigId,
  strapiUrl = process.env.NEXT_PUBLIC_STRAPI_URL ?? "http://localhost:1337",
}: MetadataInspectButtonProps) {
  if (!metaId && !siteMetaConfigId) {
    return null;
  }

  const pageMetaUrl = metaId
    ? buildStrapiEntryUrl({
        strapiUrl,
        documentId: metaId,
        typename: "MetaData",
      })
    : null;

  const siteMetaUrl = siteMetaConfigId
    ? buildStrapiEntryUrl({
        strapiUrl,
        documentId: siteMetaConfigId,
        typename: "SiteMetaConfig",
      })
    : null;

  const buttonClassName =
    "group fixed z-60 flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border-2 border-dashed border-gold bg-transparent shadow-[0_8px_28px_rgba(27,38,56,0.38),0_0_20px_rgba(184,134,58,0.7),0_0_40px_rgba(184,134,58,0.3)] transition-[border-color,box-shadow] hover:border-gold-mid hover:shadow-[0_10px_36px_rgba(27,38,56,0.45),0_0_28px_rgba(184,134,58,0.85),0_0_56px_rgba(184,134,58,0.4)]";

  const tooltipClassName =
    "pointer-events-none absolute left-full top-1/2 ml-2 -translate-y-1/2 whitespace-nowrap rounded-md border-2 border-gold bg-transparent px-2.5 py-1.5 text-xs font-medium text-gold opacity-0 shadow-[0_10px_36px_rgba(27,38,56,0.45),0_0_28px_rgba(184,134,58,0.85),0_0_56px_rgba(184,134,58,0.4)] transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100";

  return (
    <div className="fixed left-4 top-4 z-60 flex flex-col gap-2">
      {pageMetaUrl ? (
        <a
          href={pageMetaUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={PAGE_META_TOOLTIP}
          title={PAGE_META_TOOLTIP}
          className={buttonClassName}
        >
          <span aria-hidden="true" className="text-lg leading-none">
            ⚙️
          </span>
          <span role="tooltip" className={tooltipClassName}>
            {PAGE_META_TOOLTIP}
          </span>
        </a>
      ) : null}

      {siteMetaUrl ? (
        <a
          href={siteMetaUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={SITE_META_TOOLTIP}
          title={SITE_META_TOOLTIP}
          className={buttonClassName}
        >
          <span aria-hidden="true" className="text-lg leading-none">
            🌐
          </span>
          <span role="tooltip" className={tooltipClassName}>
            {SITE_META_TOOLTIP}
          </span>
        </a>
      ) : null}
    </div>
  );
}
