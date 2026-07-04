import Link from "next/link";
import { ZeroCmsEntry, ZeroCmsEntryField, ZeroCmsList } from "@usc/zero-cms-widget";
import { Button } from "@/components/ui/button";
import type { PageHeroSectionFragment } from "@/generated/graphql";

type PageHeroSectionProps = { data: PageHeroSectionFragment };

export function PageHeroSection({ data }: PageHeroSectionProps) {
  const { breadcrumbLabel, overline, title, subtitle, buttons } = data;
  const buttonItems = buttons?.filter(Boolean) ?? [];

  return (
    <ZeroCmsEntry entry={data}>
      <section className="bg-dark text-white">
        <div className="mx-auto max-w-container px-6 py-[72px] pb-16">
          {breadcrumbLabel ? (
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
                  <ZeroCmsEntryField field="breadcrumbLabel" as="span">
                    <span>{breadcrumbLabel}</span>
                  </ZeroCmsEntryField>
                </li>
              </ol>
            </nav>
          ) : null}

          {overline ? (
            <ZeroCmsEntryField field="overline">
              <p className="mt-3.5 text-[11px] font-bold tracking-[0.12em] text-gold uppercase">
                {overline}
              </p>
            </ZeroCmsEntryField>
          ) : null}

          {title ? (
            <ZeroCmsEntryField field="title">
              <h1 className="mt-3.5 font-serif text-[clamp(32px,4vw,48px)] leading-tight text-white">
                {title}
              </h1>
            </ZeroCmsEntryField>
          ) : null}

          {subtitle ? (
            <ZeroCmsEntryField field="subtitle">
              <p className="mt-4 max-w-[600px] text-lg leading-[1.7] text-white/68">
                {subtitle}
              </p>
            </ZeroCmsEntryField>
          ) : null}

          <ZeroCmsList
            className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap"
            field="buttons"
            items={buttonItems}
          >
            {buttonItems.map((button) =>
              button ? (
                <ZeroCmsEntry key={button.id} entry={button}>
                  <Button data={button} />
                </ZeroCmsEntry>
              ) : null,
            )}
          </ZeroCmsList>
        </div>
      </section>
    </ZeroCmsEntry>
  );
}
