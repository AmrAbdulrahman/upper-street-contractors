import { ZeroCmsEntryField } from "@usc/zero-cms-widget";
import { CmsImage } from "@/components/ui/cms-image";
import { AccreditationFragment } from "@/generated/graphql";

export type AccreditationProps = {
  data: AccreditationFragment;
};

export function Accreditation({ data }: AccreditationProps) {
  const { accreditationTitle, image } = data;

  return (
    <div className="flex h-20 w-full items-center justify-center rounded-xl bg-white px-5 sm:w-auto">
      <ZeroCmsEntryField field="image" className="flex items-center justify-center">
        <CmsImage
          data={image}
          fallbackAlt={accreditationTitle ?? "Accreditation"}
          placeholderLabel=""
          sizes="200px"
          className="h-14 w-auto max-w-[180px] object-contain"
        />
      </ZeroCmsEntryField>
    </div>
  );
}
