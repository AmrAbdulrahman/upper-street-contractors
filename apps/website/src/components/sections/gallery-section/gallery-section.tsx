import { ZeroCmsEntry, ZeroCmsEntryField, ZeroCmsList } from "@usc/zero-cms-widget";
import { CmsImage } from "@/components/ui/cms-image";
import type { GallerySectionFragment } from "@/generated/graphql";

type GallerySectionProps = {
  data: GallerySectionFragment;
};

/** Runtime `columns` can't build a Tailwind class, so map the three allowed values. */
const COLUMNS: Record<number, string> = {
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-2 lg:grid-cols-3",
  4: "sm:grid-cols-2 lg:grid-cols-4",
};

/**
 * A grid of captioned photos (`figure` children). Uses <ZeroCmsList> so an
 * editor can add another photo from the page itself; removal happens in the
 * section's own Edit drawer, as everywhere else.
 */
export function GallerySection({ data }: GallerySectionProps) {
  const { title, columns, images } = data;
  const figures = (images ?? []).filter((f): f is NonNullable<typeof f> => Boolean(f));

  return (
    <ZeroCmsEntry entry={data}>
      <section className="bg-white">
        <div className="mx-auto max-w-container px-6 py-[56px]">
          {title ? (
            <ZeroCmsEntryField field="title">
              <h2 className="mb-6 font-serif text-2xl text-dark">{title}</h2>
            </ZeroCmsEntryField>
          ) : null}

          <ZeroCmsList
            field="images"
            items={figures}
            className={`grid gap-[18px] ${COLUMNS[columns ?? 3] ?? COLUMNS[3]}`}
          >
            {figures.map((figure) => (
              <ZeroCmsEntry key={figure.id} entry={figure}>
                <figure className="min-w-0">
                  <ZeroCmsEntryField field="image">
                    <CmsImage
                      data={figure.image}
                      fallbackAlt={figure.caption ?? title ?? "Renovation work"}
                      placeholderLabel="Photo placeholder"
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 360px"
                      className="h-[240px] w-full rounded-xl object-cover"
                    />
                  </ZeroCmsEntryField>
                  {figure.caption ? (
                    <ZeroCmsEntryField field="caption">
                      <figcaption className="mt-2 text-sm text-muted">
                        {figure.caption}
                      </figcaption>
                    </ZeroCmsEntryField>
                  ) : null}
                </figure>
              </ZeroCmsEntry>
            ))}
          </ZeroCmsList>
        </div>
      </section>
    </ZeroCmsEntry>
  );
}
