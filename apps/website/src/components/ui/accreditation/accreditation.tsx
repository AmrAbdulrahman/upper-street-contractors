import { ZeroCmsEntryField } from "@usc/zero-cms-widget";
import { CmsImage } from "@/components/ui/cms-image";
import { AccreditationFragment } from "@/generated/graphql";

export type AccreditationProps = {
  data: AccreditationFragment;
};

export function Accreditation({ data }: AccreditationProps) {
  const { accreditationTitle, image } = data;

  return (
    <div className="flex h-16 w-full items-center justify-center rounded-xl border border-border-light bg-white px-5 sm:w-auto">
      <ZeroCmsEntryField field="image" className="flex items-center justify-center">
        <CmsImage
          data={image}
          fallbackAlt={accreditationTitle ?? "Accreditation"}
          placeholderLabel=""
          sizes="160px"
          className="h-10 w-auto max-w-[150px] object-contain"
        />
      </ZeroCmsEntryField>
    </div>
  );
}
