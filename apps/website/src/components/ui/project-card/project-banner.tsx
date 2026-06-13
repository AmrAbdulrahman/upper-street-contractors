import { Badge, badgePropsFromContentful } from "@/components/ui/badge";
import { ProjectCardFragment } from "@/generated/graphql";
import Image from "next/image";

type ProjectBannerProps = {
  banner: ProjectCardFragment["projectBanner"];
  category: ProjectCardFragment["projectCategory"];
  heightClassName?: string;
  rounded?: boolean;
  imageSizes?: string;
  priority?: boolean;
};

export function ProjectBanner({
  banner,
  category,
  heightClassName = "h-[210px]",
  rounded = false,
  imageSizes = "(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw",
  priority = false,
}: ProjectBannerProps) {
  const categoryProps = category
    ? badgePropsFromContentful(category, {
        stripHref: true,
        className:
          "relative z-10 bg-gold px-2.5 py-1 text-[10px] font-bold tracking-[0.06em] text-white uppercase",
      })
    : null;

  const roundedClass = rounded ? "rounded-lg" : "";

  if (banner?.url) {
    return (
      <div className={`relative overflow-hidden ${heightClassName} ${roundedClass}`}>
        <Image
          src={banner.url}
          alt={banner.description ?? banner.title ?? "Project photo"}
          width={banner.width ?? 800}
          height={banner.height ?? 560}
          className="h-full w-full object-cover"
          sizes={imageSizes}
          priority={priority}
        />

        {categoryProps ? (
          <div className="absolute inset-x-0 bottom-0 flex items-end p-3.5">
            <Badge {...categoryProps} />
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div
      className={`relative flex items-end p-3.5 ${heightClassName} ${roundedClass}`}
      style={{
        background: "linear-gradient(145deg, #2a3d52, #1b2638)",
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

      {categoryProps ? <Badge {...categoryProps} /> : null}
    </div>
  );
}
