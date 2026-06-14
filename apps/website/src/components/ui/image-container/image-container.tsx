import { ImageContainerFragment } from "@/generated/graphql";
import { resolveStrapiMediaUrl } from "@/helpers/strapi-media-url";
import Image from "next/image";import type { CSSProperties } from "react";

export const IMAGE_RADIUS_CLASSES = {
  none: "rounded-none",
  sm: "rounded-sm",
  md: "rounded-md",
  lg: "rounded-lg",
  xl: "rounded-xl",
  "2xl": "rounded-2xl",
  "3xl": "rounded-3xl",
  full: "rounded-full",
} as const;

export type ImageRadiusToken = keyof typeof IMAGE_RADIUS_CLASSES;

export type ImageContainerProps = {
  data: ImageContainerFragment | null | undefined;
  alt?: string;
  className?: string;
  placeholderLabel?: string;
};

export function normalizeImageRadius(radius?: string | null): string {
  const key = radius?.trim().toLowerCase() as ImageRadiusToken | undefined;

  if (key && key in IMAGE_RADIUS_CLASSES) {
    return IMAGE_RADIUS_CLASSES[key];
  }

  return IMAGE_RADIUS_CLASSES.xl;
}

function getImageAlt(
  data: ImageContainerFragment,
  alt?: string,
): string {
  return (
    alt ??
    data.imgDescription ??
    data.imageFile?.alternativeText ??
    "Image"
  );
}

export function ImageContainer({
  data,
  alt,
  className,
  placeholderLabel = "Image placeholder",
}: ImageContainerProps) {
  if (!data) {
    return null;
  }

  const image = data.imageFile;
  const radiusClass = normalizeImageRadius(data.imageRadius);
  const hasExplicitWidth = data.width != null;
  const hasExplicitHeight = data.height != null;

  const imageClasses = [
    "overflow-hidden",
    "object-cover",
    radiusClass,
    !hasExplicitWidth ? "w-full" : "",
    !hasExplicitHeight ? "h-[340px]" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const imageStyle: CSSProperties = {
    width: hasExplicitWidth ? data.width ?? undefined : "100%",
    height: hasExplicitHeight ? data.height ?? undefined : undefined,
  };

  const imageUrl = resolveStrapiMediaUrl(image?.url);

  if (!imageUrl) {
    return (
      <div
        className={`flex items-center justify-center text-sm text-white/15 ${imageClasses}`}
        style={{
          ...imageStyle,
          background: "linear-gradient(145deg, #2a3d52, #1b2638)",
        }}
      >
        {placeholderLabel}
      </div>
    );
  }

  const imageAlt = getImageAlt(data, alt);

  return (
    <Image
      src={imageUrl}
      alt={imageAlt}
      width={data.width ?? image?.width ?? 800}
      height={data.height ?? image?.height ?? 680}
      className={imageClasses}
      style={imageStyle}
      sizes="(max-width: 1024px) 100vw, 536px"
    />
  );
}
