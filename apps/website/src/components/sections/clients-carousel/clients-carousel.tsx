import { ZeroCmsEntry, ZeroCmsEntryField } from "@usc/zero-cms-widget";
import Link from "next/link";
import { CmsImage } from "@/components/ui/cms-image";
import { resolveLogoHeight } from "@/helpers";
import type { ClientsCarouselFragment } from "@/generated/graphql";

/** Height used when the section has no CMS `logoSize` (was `h-12`). */
const CLIENT_LOGO_HEIGHT = 48;

/** `max-w-[160px]` at the previous `h-12` height — kept so wide wordmarks
 *  still cap at the same proportion once the height is editable. */
const LOGO_MAX_ASPECT = 160 / 48;

type ClientsCarouselProps = {
  data: ClientsCarouselFragment;
};

type ClientLogoItem = NonNullable<
  NonNullable<ClientsCarouselFragment["logos"]>[number]
>;

function LogoMark({
  logo,
  height,
}: {
  logo: ClientLogoItem;
  height: number;
}) {
  const maxWidth = Math.round(height * LOGO_MAX_ASPECT);
  const image = (
    <CmsImage
      data={logo.image}
      fallbackAlt={logo.name ?? "Client"}
      placeholderLabel=""
      sizes={`${maxWidth}px`}
      // Always full colour, at every width, hover or not. These are the clients'
      // own marks — greying them out until a visitor happens to hover made the
      // section look faded rather than restrained, and on touch there is no hover
      // to reveal them with at all.
      // No hover zoom either: the track scrolls continuously, so a mark that
      // also scales under the pointer just jitters as it slides past.
      zoom={false}
      className="w-auto object-contain"
      style={{ height, maxWidth }}
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
  const logoHeight = resolveLogoHeight(data.logoSize, CLIENT_LOGO_HEIGHT);

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
                  <LogoMark logo={logo} height={logoHeight} />
                </div>
              ))}
              {/* Duplicated set makes the translateX(-50%) loop seamless. */}
              {items.map((logo) => (
                <div
                  key={`dup-${logo.id}`}
                  aria-hidden="true"
                  className="flex shrink-0 items-center justify-center pr-14"
                >
                  <LogoMark logo={logo} height={logoHeight} />
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
