import {
  StrapiEntry,
  StrapiEntryField,
  StrapiRelationEntry,
} from "@/components/strapi";
import { Icon } from "@/components/ui/icon";
import { BulletListFragment } from "@/generated/graphql";

type BulletListProps = {
  data: BulletListFragment;
};

export function BulletList({ data }: BulletListProps) {
  const { text, listIcon } = data;

  return (
    <StrapiEntry entry={data}>
      <li className="flex items-start gap-3">
        <StrapiRelationEntry entry={listIcon} field="listIcon" as="span">
          <span
            aria-hidden
            className="mt-0.5 flex size-[22px] shrink-0 items-center justify-center rounded-full bg-gold text-white"
          >
            {listIcon ? (
              <Icon data={listIcon} className="size-3 text-white" />
            ) : (
              <span className="text-[11px] leading-none">✓</span>
            )}
          </span>
        </StrapiRelationEntry>

        {text ? (
          <StrapiEntryField field="text" as="span">
            <span className="text-[15px] leading-[1.65] text-muted">{text}</span>
          </StrapiEntryField>
        ) : null}
      </li>
    </StrapiEntry>
  );
}
