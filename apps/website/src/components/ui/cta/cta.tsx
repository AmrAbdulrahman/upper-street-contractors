import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import type { CtaFragment } from "@/generated/graphql";
import { ZeroCmsEntry, ZeroCmsEntryField } from "@usc/zero-cms-widget";

export type CtaVariant = "section" | "sidebar";

type CtaProps = {
  data: CtaFragment;
  variant?: CtaVariant;
};

export function Cta({ data, variant = "section" }: CtaProps) {
  const { title, cost, subtitle, banner, buttons } = data;
  const items = (buttons ?? []).filter(
    (b): b is NonNullable<typeof b> => Boolean(b),
  );

  if (variant === "sidebar") {
    return (
      <ZeroCmsEntry entry={data}>
        <div className="rounded-xl border border-white/10 bg-dark p-6 text-white shadow-lg">
          {title ? (
            <ZeroCmsEntryField field="title">
              <p className="text-[11px] font-semibold tracking-[0.14em] text-white/55 uppercase">
                {title}
              </p>
            </ZeroCmsEntryField>
          ) : null}

          {cost ? (
            <ZeroCmsEntryField field="cost">
              <p className="mt-2 font-serif text-[42px] leading-none text-gold">
                {cost}
              </p>
            </ZeroCmsEntryField>
          ) : null}

          {subtitle ? (
            <ZeroCmsEntryField field="subtitle">
              <p className="mt-3 text-sm leading-relaxed text-white/65">
                {subtitle}
              </p>
            </ZeroCmsEntryField>
          ) : null}

          {banner ? (
            <ZeroCmsEntry entry={banner}>
              <Banner data={banner} className="mt-4" />
            </ZeroCmsEntry>
          ) : null}

          {items.length ? (
            <div className="mt-4 flex flex-col gap-2.5">
              {items.map((b) => (
                <ZeroCmsEntry key={b.id} entry={b}>
                  <Button data={b} className="w-full" />
                </ZeroCmsEntry>
              ))}
            </div>
          ) : null}
        </div>
      </ZeroCmsEntry>
    );
  }

  return (
    <ZeroCmsEntry entry={data}>
      <div className="mx-auto max-w-container px-6 py-[88px] text-center">
        {title ? (
          <ZeroCmsEntryField field="title">
            <h2 className="font-serif text-[clamp(28px,3.4vw,42px)] leading-tight text-white">
              {title}
            </h2>
          </ZeroCmsEntryField>
        ) : null}

        {subtitle ? (
          <ZeroCmsEntryField field="subtitle">
            <p className="mx-auto mt-3 max-w-xl text-lg leading-relaxed text-white/70">
              {subtitle}
            </p>
          </ZeroCmsEntryField>
        ) : null}

        {items.length ? (
          <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
            {items.map((b) => (
              <ZeroCmsEntry key={b.id} entry={b}>
                <Button data={b} className="w-full sm:w-auto" />
              </ZeroCmsEntry>
            ))}
          </div>
        ) : null}
      </div>
    </ZeroCmsEntry>
  );
}
