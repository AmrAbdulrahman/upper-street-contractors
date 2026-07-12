import { ZeroCmsEntry, ZeroCmsEntryField } from "@usc/zero-cms-widget";
import { GoogleReviewsWidget } from "@/components/ui/google-reviews-widget";
import { GoogleReviewsFragment } from "@/generated/graphql";

type GoogleReviewsSectionProps = {
  data: GoogleReviewsFragment;
};

export function GoogleReviewsSection({ data }: GoogleReviewsSectionProps) {
  const { overline, title } = data;

  return (
    <ZeroCmsEntry entry={data}>
      <section className="bg-surface">
        <div className="mx-auto max-w-container px-6 py-[72px]">
          {overline || title ? (
            <div className="mb-8 text-center">
              {overline ? (
                <ZeroCmsEntryField field="overline">
                  <p className="text-[11px] font-bold tracking-[0.12em] text-gold-deep uppercase">
                    {overline}
                  </p>
                </ZeroCmsEntryField>
              ) : null}
              {title ? (
                <ZeroCmsEntryField field="title">
                  <h2 className="mt-2.5 text-[clamp(24px,3.5vw,34px)] leading-tight text-dark">
                    {title}
                  </h2>
                </ZeroCmsEntryField>
              ) : null}
            </div>
          ) : null}

          <GoogleReviewsWidget />
        </div>
      </section>
    </ZeroCmsEntry>
  );
}
