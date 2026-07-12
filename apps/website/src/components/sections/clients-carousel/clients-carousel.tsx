import { ZeroCmsEntry, ZeroCmsEntryField } from "@usc/zero-cms-widget";
import Link from "next/link";
import { CmsImage } from "@/components/ui/cms-image";
import type { ClientsCarouselFragment } from "@/generated/graphql";

type ClientsCarouselProps = {
  data: ClientsCarouselFragment;
};

type ClientLogoItem = NonNullable<
  NonNullable<ClientsCarouselFragment["logos"]>[number]
>;

function LogoMark({ logo }: { logo: ClientLogoItem }) {
  const image = (
    <CmsImage
      data={logo.image}
      fallbackAlt={logo.name ?? "Client"}
      placeholderLabel=""
      sizes="180px"
      // Full colour on tablet + mobile; grayscale/dimmed only on desktop (lg+),
      // where the hover rule in globals.css recolours on hover.
      className="h-12 w-auto max-w-[160px] object-contain opacity-100 grayscale-0 transition-all duration-300 lg:opacity-70 lg:grayscale"
    />
  );

  if (logo.url) {
    return (
      <Link
        href={logo.url}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={logo.name ?? "Client"}
        className="rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
      >
        {image}
      </Link>
    );
  }

  return image;
}

export function ClientsCarousel({ data }: ClientsCarouselProps) {
  const { title, logos } = data;
  const items = (logos?.filter(Boolean) ?? []) as ClientLogoItem[];

  if (items.length === 0) {
    return null;
  }

  return (
    <ZeroCmsEntry entry={data}>
      <section className="border-y border-border-light bg-white">
        <div className="mx-auto max-w-container px-6 py-14">
          {title ? (
            <ZeroCmsEntryField field="title">
              <p className="mb-9 text-center text-[11px] font-bold tracking-[0.12em] text-muted uppercase">
                {title}
              </p>
            </ZeroCmsEntryField>
          ) : null}

          <div
            className="clients-marquee relative overflow-hidden"
            role="region"
            aria-label={title || "Our clients"}
          >
            <div className="clients-marquee-track">
              {items.map((logo) => (
                <div
                  key={logo.id}
                  className="flex shrink-0 items-center justify-center pr-14"
                >
                  <LogoMark logo={logo} />
                </div>
              ))}
              {/* Duplicated set makes the translateX(-50%) loop seamless. */}
              {items.map((logo) => (
                <div
                  key={`dup-${logo.id}`}
                  aria-hidden="true"
                  className="flex shrink-0 items-center justify-center pr-14"
                >
                  <LogoMark logo={logo} />
                </div>
              ))}
            </div>

            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-white to-transparent"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-white to-transparent"
            />
          </div>
        </div>
      </section>
    </ZeroCmsEntry>
  );
}
