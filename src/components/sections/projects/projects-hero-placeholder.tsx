import Link from "next/link";

export function ProjectsHeroPlaceholder() {
  return (
    <section className="bg-dark text-white">
      <div className="mx-auto max-w-container px-6 py-[72px] pb-16">
        <nav aria-label="Breadcrumb">
          <ol className="flex flex-wrap items-center gap-2 text-[13px] text-subtle">
            <li>
              <Link href="/" className="transition-colors hover:text-white">
                Home
              </Link>
            </li>
            <li aria-hidden className="text-subtle">
              /
            </li>
            <li aria-current="page" className="text-subtle">
              Projects
            </li>
          </ol>
        </nav>

        <p className="mt-3.5 text-[11px] font-bold tracking-[0.12em] text-gold uppercase">
          Projects
        </p>

        <h1 className="mt-3.5 font-serif text-[clamp(32px,4vw,48px)] leading-tight text-white">
          Renovations in North London
        </h1>

        <p className="mt-4 max-w-[600px] text-lg leading-[1.7] text-white/68">
          Bathrooms, kitchens and home refurbishments delivered across Islington
          and nearby areas. Each case study includes scope, location and timeline.
        </p>
      </div>
    </section>
  );
}
