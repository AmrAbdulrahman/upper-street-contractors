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
  /**
   * Sizing utilities applied to the CREST (set a height; width stays auto), and
   * to the whole mark in `compact` mode.
   */
  className?: string;
  /**
   * Sizing utilities for the WORDMARK. Kept separate from {@link className} so a
   * caller can shrink the crest on scroll while the words stay put — pass a fixed
   * height here and let `className` be the one that changes.
   *
   * Defaults to a height rather than nothing: the artwork's intrinsic box is
   * 491×287, so an omitted height would render the words at 287px tall.
   *
   * Note this sizes the artwork's **box**, which keeps the banner's full 287-unit
   * height so the words sit at the same scale they did inside the combined
   * lockup. The lettering itself is a stacked block filling ~80% of that box
   * vertically, so a given height here renders noticeably smaller glyphs than the
   * same height on a single-line wordmark would.
   */
  wordmarkClassName?: string;
};

// Intrinsic dimensions match each SVG's viewBox aspect ratio.
const CREST = { width: 234, height: 287 };
const WORDMARK = { width: 491, height: 287 };

/**
 * The brand lockup — the crest and the "Upper Street Contractors" wordmark.
 *
 * Two images, not one. It used to be a single `banner-*.svg`, which meant any
 * height change scaled both halves together: shrinking the header on scroll took
 * the words down with the crest until they were unreadable. Split, the crest can
 * shrink while the wordmark holds one size, which is how the mark is meant to
 * behave — the crest is decoration, the words are the name.
 *
 * `wordmark-*.svg` is the banner artwork with its viewBox cropped past the crest
 * rather than a re-export: the SVG viewport does the hiding, so no path was
 * touched and no glyph can go missing in the process.
 */
export function SiteBanner({
  siteName,
  tone = "dark",
  compact = false,
  href = "/",
  className,
  wordmarkClassName = "h-6",
}: SiteBannerProps) {
  const alt = siteName || "Upper Street Contractors";
  const crestSrc = tone === "light" ? "/logo-light.svg" : "/logo-dark.svg";
  const wordmarkSrc = tone === "light" ? "/wordmark-light.svg" : "/wordmark-dark.svg";

  const crest = (
    <Image
      src={crestSrc}
      // The wordmark carries the accessible name for the pair; a crest that
      // repeats it would have a screen reader read the company twice.
      alt={compact ? alt : ""}
      width={CREST.width}
      height={CREST.height}
      priority
      className={`w-auto ${className ?? ""}`}
    />
  );

  const image = compact ? (
    crest
  ) : (
    <span className="inline-flex items-center gap-2">
      {crest}
      <Image
        src={wordmarkSrc}
        alt={alt}
        width={WORDMARK.width}
        height={WORDMARK.height}
        priority
        className={`w-auto ${wordmarkClassName ?? ""}`}
      />
    </span>
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
