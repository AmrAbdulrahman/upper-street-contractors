import { ZeroCmsEntry, ZeroCmsEntryField } from "@usc/zero-cms-widget";
import { RichTextViewer } from "@/components/ui/rich-text-viewer";
import { Button } from "@/components/ui/button";
import { AtAGlance } from "@/components/ui/at-a-glance";
import type { HomeHeroSectionFragment } from "@/generated/graphql";

export type HomeHeroData = NonNullable<
  HomeHeroSectionFragment
>;

export default function HomeHeroSection({ data: hero }: { data: HomeHeroData }) {
  const buttons = hero.buttons?.filter(Boolean) ?? [];

  return (
    <section className="hero relative overflow-hidden bg-dark text-white">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(ellipse_80%_60%_at_75%_40%,color-mix(in_srgb,var(--color-dark)_90%,transparent),transparent_70%)]"
      />

      <div className="relative z-10 mx-auto grid max-w-container items-center gap-12 px-6 py-16 md:px-10 md:py-20 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-16 lg:py-24">
        <ZeroCmsEntry entry={hero}>
          <div className="flex min-w-0 flex-col gap-8">
            {hero.overline ? (
              <ZeroCmsEntryField field="overline">
                <p className="flex items-center gap-2 text-xs font-medium tracking-[0.22em] text-gold uppercase">
                  <span aria-hidden className="eyebrow-dot" />
                  {hero.overline}
                </p>
              </ZeroCmsEntryField>
            ) : null}

            {hero.headerTitle ? (
              <ZeroCmsEntryField field="title">
                <RichTextViewer
                  content={hero.headerTitle}
                  variant="hero-title"
                  as="h1"
                  className="text-4xl leading-[1.15] tracking-tight text-white sm:text-5xl"
                />
              </ZeroCmsEntryField>
            ) : null}

            {hero.subtitle ? (
              <ZeroCmsEntryField field="subtitle">
                <p className="max-w-xl text-lg leading-relaxed text-subtle">
                  {hero.subtitle}
                </p>
              </ZeroCmsEntryField>
            ) : null}

            {buttons.length ? (
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                {buttons.map((button) => (
                  <ZeroCmsEntry key={button.id} entry={button}>
                    <Button data={button} />
                  </ZeroCmsEntry>
                ))}
              </div>
            ) : null}

            {hero.footer ? (
              <ZeroCmsEntryField field="footer">
                <RichTextViewer
                  content={hero.footer}
                  variant="hero-footer"
                  className="max-w-xl"
                />
              </ZeroCmsEntryField>
            ) : null}
          </div>
        </ZeroCmsEntry>

        <div className="min-w-0">
          <AtAGlance />
        </div>
      </div>
    </section>
  );
}
