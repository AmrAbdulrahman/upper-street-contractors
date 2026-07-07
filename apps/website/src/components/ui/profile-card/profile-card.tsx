import { ZeroCmsEntryField } from "@usc/zero-cms-widget";
import { RichTextViewer } from "@/components/ui/rich-text-viewer";
import { Banner } from "@/components/ui/banner";
import { CmsImage, type CmsImageData } from "@/components/ui/cms-image";
import type { BannerFragment } from "@/generated/graphql";

type ProfileCardProps = {
  image?: CmsImageData;
  title?: string | null;
  role?: string | null;
  paragraph?: unknown;
  banner?: BannerFragment | null;
  imageAlt?: string;
};

export function ProfileCard({
  image,
  title,
  role,
  paragraph,
  banner,
  imageAlt,
}: ProfileCardProps) {
  return (
    <div className="rounded-3xl bg-dark px-8 py-9 text-white">
      <ZeroCmsEntryField field="cardImage">
        <div className="mb-[18px] size-[72px] shrink-0 overflow-hidden rounded-full border-2 border-white/10">
          <CmsImage
            data={image}
            fallbackAlt={imageAlt ?? title ?? "Profile photo"}
            placeholderLabel="PHOTO"
            className="size-[72px] rounded-full object-cover"
          />
        </div>
      </ZeroCmsEntryField>

      {title ? (
        <ZeroCmsEntryField field="cardTitle">
          <p className="text-xl leading-snug text-white">{title}</p>
        </ZeroCmsEntryField>
      ) : null}

      {role ? (
        <ZeroCmsEntryField field="cardRole">
          <p className="mt-1 text-[13px] font-semibold text-gold-mid">{role}</p>
        </ZeroCmsEntryField>
      ) : null}

      {paragraph ? (
        <ZeroCmsEntryField field="cardParagraph">
          <RichTextViewer
            content={paragraph}
            variant="banner-body-dark"
            className="mt-4 flex flex-col gap-4 text-[15px] leading-[1.75] text-white/65"
          />
        </ZeroCmsEntryField>
      ) : null}

      {/* Banner self-wraps in its own ZeroCmsEntry → clicking it opens the
          banner entry directly. */}
      {banner ? <Banner data={banner} className="mt-8" /> : null}
    </div>
  );
}
