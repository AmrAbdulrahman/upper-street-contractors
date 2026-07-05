import Image from "next/image";
import { resolveStrapiMediaUrl } from "@/helpers/strapi-media-url";

/**
 * The shape of a zero-cms `asset` field once resolved to GraphQL `Media`
 * ({ url, alt, width, height }). Structural so any `Media` selection matches.
 */
export type CmsImageData =
  | {
      url?: string | null;
      alt?: string | null;
      width?: number | null;
      height?: number | null;
    }
  | null
  | undefined;

export type CmsImageProps = {
  data: CmsImageData;
  /** Fallback alt used only when the media has no alt text of its own. */
  fallbackAlt?: string;
  /** Fixed sizing + rounding for this call site (imageContainer's CMS radius/size is gone). */
  className?: string;
  /** Shown in place of the image when the asset is empty. */
  placeholderLabel?: string;
  sizes?: string;
};

/**
 * Renders a plain media asset with `next/image`. Alt text comes from the media's
 * own `alt` (backed by MediaItem.alternativeText, editable in /admin) — the single
 * source of alt text for every image — falling back to `fallbackAlt` when unset.
 * Replaces the removed `<ImageContainer>`; sizing/rounding is fixed per call site
 * via `className` rather than CMS width/height/radius fields.
 */
export function CmsImage({
  data,
  fallbackAlt,
  className,
  placeholderLabel = "Image placeholder",
  sizes = "(max-width: 1024px) 100vw, 536px",
}: CmsImageProps) {
  const url = resolveStrapiMediaUrl(data?.url);
  const alt = data?.alt?.trim() || fallbackAlt || "";

  if (!url) {
    return (
      <div
        className={`flex items-center justify-center text-sm text-white/15 ${className ?? ""}`}
        style={{ background: "linear-gradient(145deg, #0a1c2e, #031021)" }}
      >
        {placeholderLabel}
      </div>
    );
  }

  return (
    <Image
      src={url}
      alt={alt}
      width={data?.width ?? 800}
      height={data?.height ?? 680}
      className={className}
      sizes={sizes}
    />
  );
}
