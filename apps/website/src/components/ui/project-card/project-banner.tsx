import { Badge } from "@/components/ui/badge";
import { resolveMediaUrl } from "@/helpers/media-url";
import Image from "next/image";

type BannerMedia =
  | {
      url?: string | null;
      alt?: string | null;
      width?: number | null;
      height?: number | null;
    }
  | null
  | undefined;

type ProjectBannerProps = {
  banner: BannerMedia;
  /** The project Category (enum value), rendered as the gold Category tag. */
  category?: string | null;
  heightClassName?: string;
  rounded?: boolean;
  imageSizes?: string;
  priority?: boolean;
};

const categoryTagClasses =
  "relative z-10 bg-gold px-2.5 py-1 text-[10px] font-bold tracking-[0.06em] text-white uppercase";

export function ProjectBanner({
  banner,
  category,
  heightClassName = "h-[210px]",
  rounded = false,
  imageSizes = "(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw",
  priority = false,
}: ProjectBannerProps) {
  const label = category?.trim();
  const categoryTag = label ? (
    <Badge variant="dark" className={categoryTagClasses}>
      {label}
    </Badge>
  ) : null;

  const roundedClass = rounded ? "rounded-lg" : "";
  const bannerUrl = resolveMediaUrl(banner?.url);

  if (bannerUrl) {
    return (
      <div className={`relative overflow-hidden ${heightClassName} ${roundedClass}`}>
        <Image
          src={bannerUrl}
          alt={banner?.alt ?? "Project photo"}
          width={banner?.width ?? 800}
          height={banner?.height ?? 560}
          className="h-full w-full object-cover"
          sizes={imageSizes}
          priority={priority}
        />

        {categoryTag ? (
          <div className="absolute left-3.5 top-3.5">{categoryTag}</div>
        ) : null}
      </div>
    );
  }

  return (
    <div
      className={`relative flex items-end p-3.5 ${heightClassName} ${roundedClass}`}
      style={{
        background: "linear-gradient(145deg, #0a1c2e, #031021)",
      }}
    >
      <span
        aria-hidden
        className={`pointer-events-none absolute inset-0 ${roundedClass}`}
        style={{
          background:
            "repeating-linear-gradient(45deg, transparent, transparent 30px, rgba(255,255,255,0.02) 30px, rgba(255,255,255,0.02) 60px)",
        }}
      />

      <span
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-xs font-medium text-white/15"
      >
        Photo placeholder
      </span>

      {categoryTag ? (
        <div className="absolute left-3.5 top-3.5">{categoryTag}</div>
      ) : null}
    </div>
  );
}
