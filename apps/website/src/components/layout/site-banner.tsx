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
  /** Render the crest-only mark instead of the full crest + wordmark lockup. */
  compact?: boolean;
  href?: string | null;
  /** Sizing utilities (set a height; width stays auto). */
  className?: string;
};

// Intrinsic dimensions match each SVG's viewBox aspect ratio.
const BANNER = { width: 732, height: 287 };
const CREST = { width: 234, height: 287 };

export function SiteBanner({
  siteName,
  tone = "dark",
  compact = false,
  href = "/",
  className,
}: SiteBannerProps) {
  const alt = siteName || "Upper Street Contractors";

  const src = compact
    ? tone === "light"
      ? "/logo-light.svg"
      : "/logo-dark.svg"
    : tone === "light"
      ? "/banner-light.svg"
      : "/banner-dark.svg";

  const { width, height } = compact ? CREST : BANNER;

  const image = (
    <Image
      src={src}
      alt={alt}
      width={width}
      height={height}
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
