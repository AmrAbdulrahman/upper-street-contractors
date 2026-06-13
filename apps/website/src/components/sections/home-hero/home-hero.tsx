import { AddContentfulEntry, ContentfulEntry, ContentfulEntryField } from "@/components/contentful";
import { RichText } from "@/components/contentful/rich-text";
import { Button } from "@/components/ui/button";
import { AtAGlance } from "@/components/ui/at-a-glance";
import { HomeHeroSectionFragment } from "@/generated/graphql";
import type { Document } from "@contentful/rich-text-types";

type HeroProps = {
  data: HomeHeroSectionFragment;
}

export default function HeroHeroSection({ data: hero }: HeroProps) {
  // const { data } = await getClient().query({
  //   query: GetHomeHeroSectionDocument,
  // });

  // const hero = data?.homeHeaderSectionCollection?.items?.at(0) ?? null;

  // if (!hero) {
  //   return null;
  // }

  const titleDocument = hero.richTextTitle?.json as Document | undefined;
  const footerDocument = hero.footer?.json as Document | undefined;

  return (
      <section className="hero relative overflow-hidden bg-dark text-white">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(ellipse_80%_60%_at_75%_40%,color-mix(in_srgb,var(--color-dark)_90%,transparent),transparent_70%)]"
        />

        <div className="relative z-10 mx-auto grid max-w-container items-center gap-12 px-6 py-16 md:px-10 md:py-20 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-16 lg:py-24">
          <ContentfulEntry entry={hero}>
            <div className="min-w-0 flex flex-col gap-8">
              {hero.overline ? (
                <ContentfulEntryField field="overline">
                  <p className="flex items-center gap-2 text-xs font-medium tracking-[0.22em] text-gold uppercase">
                    <span aria-hidden className="eyebrow-dot" />
                    {hero.overline}
                  </p>
                </ContentfulEntryField>
              ) : null}

              {titleDocument ? (
                <ContentfulEntryField field="title">
                  <RichText
                    document={titleDocument}
                    variant="hero-title"
                    as="h1"
                    className="text-4xl leading-[1.15] tracking-tight text-white sm:text-5xl"
                  />
                </ContentfulEntryField>
              ) : null}

              {hero.subtitle ? (
                <ContentfulEntryField field="subtitle">
                  <p className="max-w-xl text-lg leading-relaxed text-subtle">
                    {hero.subtitle}
                  </p>
                </ContentfulEntryField>
              ) : null}

              {hero.buttonsCollection?.items?.length ? (
                <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                  {hero.buttonsCollection.items.map((button) =>
                    button ? (
                      <ContentfulEntry key={button._id} entry={button}>
                        <Button data={button} />
                      </ContentfulEntry>
                    ) : null,
                  )}

                  <AddContentfulEntry field="buttons" />
                </div>
              ) : null}

              {footerDocument ? (
                <ContentfulEntryField field="footer">
                  <RichText
                    document={footerDocument}
                    variant="hero-footer"
                    className="max-w-xl"
                  />
                </ContentfulEntryField>
              ) : null}
            </div>
          </ContentfulEntry>

          <div className="min-w-0">
            <AtAGlance />
          </div>
        </div>
      </section>
  );
}
