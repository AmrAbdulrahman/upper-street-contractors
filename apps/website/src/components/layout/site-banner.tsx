import Image from "next/image";
import Link from "next/link";

type SiteBannerProps = {
  siteName?: string | null;
  /**
   * Which coloured variant to render:
   * - `"dark"` → navy artwork, for LIGHT backgrounds (header).
   * - `"light"` → white artwork, for DARK backgrounds (footer).
   */
  tone?: "dark" | "light";
  href?: string | null;
  /** Sizing utilities for the mark — set a height; the width stays auto. */
  className?: string;
  /**
   * CMS-supplied artwork, from Site settings. Each tone is optional and falls
   * back independently to the committed SVG, so an editor who uploads only a
   * light-background logo still gets the built-in one in the footer.
   */
  logos?: {
    dark?: string | null;
    light?: string | null;
  } | null;
};

// Intrinsic dimensions match the SVG's viewBox aspect ratio (~2.55:1).
const BANNER = { width: 732, height: 287 };

/**
 * The brand lockup — the crest and the "Upper Street Contractors" wordmark.
 *
 * One image, not two. It was split into a crest and a cropped wordmark so the
 * header could shrink the crest on scroll while the words held one size. The
 * header no longer shrinks — it is a single fixed-height row since the Services
 * menu replaced the row of nine service links — so the split was paying for a
 * behaviour nothing uses, at the cost of two requests, two sizing props and a
 * gap between the halves that had to be tuned to imitate the original artwork.
 *
 * `banner-*.svg` is that original artwork; `logo-*.svg` and `wordmark-*.svg` are
 * the same file with the viewBox cropped, which is why the proportions here are
 * unchanged from the pair they replace.
 */
export function SiteBanner({
  siteName,
  tone = "dark",
  href = "/",
  className,
  logos,
}: SiteBannerProps) {
  const alt = siteName || "Upper Street Contractors";
  const src =
    (tone === "light" ? logos?.light : logos?.dark) ||
    (tone === "light" ? "/banner-light.svg" : "/banner-dark.svg");

  const image = (
    <Image
      src={src}
      alt={alt}
      width={BANNER.width}
      height={BANNER.height}
      priority
      className={`w-auto ${className ?? ""}`}
    />
  );

  if (!href) {
    return image;
  }

  return (
    <Link
      href={href}
      aria-label={alt}
      className="inline-flex shrink-0 items-center transition-opacity hover:opacity-90"
    >
      {image}
    </Link>
  );
}
