import { StrapiEntryField } from "@/components/strapi";
import { RichText } from "@/components/strapi/rich-text";
import { Banner } from "@/components/ui/banner";
import { ImageContainer } from "@/components/ui/image-container";
import type { BannerFragment, ImageContainerFragment } from "@/generated/graphql";

type ProfileCardProps = {
  image?: ImageContainerFragment | null;
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
      <StrapiEntryField field="cardImage">
        <div className="mb-[18px] size-[72px] shrink-0 overflow-hidden rounded-full border-2 border-white/10">
          <ImageContainer
            data={image}
            alt={imageAlt ?? title ?? "Profile photo"}
            placeholderLabel="PHOTO"
            className="!size-[72px] !h-[72px] !w-[72px] rounded-full"
          />
        </div>
      </StrapiEntryField>

      {title ? (
        <StrapiEntryField field="cardTitle">
          <p className="text-xl leading-snug text-white">{title}</p>
        </StrapiEntryField>
      ) : null}

      {role ? (
        <StrapiEntryField field="cardRole">
          <p className="mt-1 text-[13px] font-semibold text-gold-mid">{role}</p>
        </StrapiEntryField>
      ) : null}

      {paragraph ? (
        <StrapiEntryField field="cardParagraph">
          <RichText
            content={paragraph}
            variant="banner-body-dark"
            className="mt-4 flex flex-col gap-4 text-[15px] leading-[1.75] text-white/65"
          />
        </StrapiEntryField>
      ) : null}

      {banner ? (
        <StrapiEntryField field="cardBanner">
          <Banner data={banner} className="mt-8" />
        </StrapiEntryField>
      ) : null}
    </div>
  );
}
