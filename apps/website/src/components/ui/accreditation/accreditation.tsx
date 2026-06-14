import { StrapiEntryField } from "@/components/strapi";
import { Icon } from "@/components/ui/icon";
import { AccreditationFragment } from "@/generated/graphql";

export type AccreditationProps = {
  data: AccreditationFragment;
};

export function Accreditation({ data }: AccreditationProps) {
  const { accreditationTitle, icon } = data;

  return (
    <div className="ps-12 flex w-full items-center gap-2 sm:w-fit sm:max-w-full sm:gap-2.5">
      <StrapiEntryField field="icon">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gold text-white sm:h-8 sm:w-8">
          <Icon data={icon} className="h-3 w-3 shrink-0 sm:h-4 sm:w-4" />
        </span>
      </StrapiEntryField>

      {accreditationTitle ? (
        <StrapiEntryField field="accreditationTitle" className="min-w-0">
          <p className="font-medium text-dark text-sm">{accreditationTitle}</p>
        </StrapiEntryField>
      ) : null}
    </div>
  );
}
