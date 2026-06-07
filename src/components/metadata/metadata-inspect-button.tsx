import { buildContentfulEntryUrl } from "@/lib/contentful/entry-url";

const TOOLTIP = "Change this pages meta information";

export type MetadataInspectButtonProps = {
  metaId: string;
  spaceId: string;
  environmentId?: string;
};

export function MetadataInspectButton({
  metaId,
  spaceId,
  environmentId = "master",
}: MetadataInspectButtonProps) {
  if (!metaId || !spaceId) {
    return null;
  }

  const editUrl = buildContentfulEntryUrl({
    spaceId,
    environmentId,
    entryId: metaId,
  });

  return (
    <a
      href={editUrl}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={TOOLTIP}
      title={TOOLTIP}
      className="group fixed left-4 top-4 z-60 flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border-2 border-dashed border-gold bg-transparent shadow-[0_8px_28px_rgba(27,38,56,0.38),0_0_20px_rgba(184,134,58,0.7),0_0_40px_rgba(184,134,58,0.3)] transition-[border-color,box-shadow] hover:border-gold-mid hover:shadow-[0_10px_36px_rgba(27,38,56,0.45),0_0_28px_rgba(184,134,58,0.85),0_0_56px_rgba(184,134,58,0.4)]"
    >
      <span aria-hidden="true" className="text-lg leading-none">
        ⚙️
      </span>
      <span
        role="tooltip"
        className="pointer-events-none absolute left-full top-1/2 ml-2 -translate-y-1/2 whitespace-nowrap rounded-md border-2 border-gold bg-transparent px-2.5 py-1.5 text-xs font-medium text-gold opacity-0 shadow-[0_10px_36px_rgba(27,38,56,0.45),0_0_28px_rgba(184,134,58,0.85),0_0_56px_rgba(184,134,58,0.4)] transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
      >
        {TOOLTIP}
      </span>
    </a>
  );
}
