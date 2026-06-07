import Link from "next/link";

type SiteLogoProps = {
  siteName?: string | null;
  href?: string;
  streetClassName?: string;
  suffixClassName?: string;
  className?: string;
};

function splitSiteName(siteName: string) {
  const lastSpace = siteName.lastIndexOf(" ");

  if (lastSpace === -1) {
    return { prefix: siteName, suffix: null };
  }

  return {
    prefix: siteName.slice(0, lastSpace + 1),
    suffix: siteName.slice(lastSpace + 1),
  };
}

export function SiteLogo({
  siteName,
  href = "/",
  streetClassName = "text-dark",
  suffixClassName = "text-gold",
  className = "text-[1.35rem] leading-none tracking-[-0.01em]",
}: SiteLogoProps) {
  if (!siteName) {
    return null;
  }

  const { prefix, suffix } = splitSiteName(siteName);

  const logo = (
    <span className={`font-serif font-normal ${className}`}>
      <span className={streetClassName}>{prefix}</span>
      {suffix ? <span className={suffixClassName}>{suffix}</span> : null}
    </span>
  );

  if (!href) {
    return logo;
  }

  return (
    <Link href={href} className="shrink-0 transition-opacity hover:opacity-90">
      {logo}
    </Link>
  );
}
