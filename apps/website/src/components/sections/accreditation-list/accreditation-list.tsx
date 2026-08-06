import { ZeroCmsEntry, ZeroCmsList } from "@usc/zero-cms-widget";
import {
  Accreditation,
  ACCREDITATION_LOGO_HEIGHT,
} from "@/components/ui/accreditation";
import { TrustpilotWidget } from "@/components/ui/trustpilot-widget";
import { resolveLogoHeight } from "@/helpers";
import { AccreditationListFragment } from "@/generated/graphql";

type AccreditationListProps = {
  data: AccreditationListFragment;
};

export function AccreditationList({ data }: AccreditationListProps) {
  const accreditations = data.list?.filter(Boolean) ?? [];
  const logoHeight = resolveLogoHeight(
    data.logoSize,
    ACCREDITATION_LOGO_HEIGHT,
  );

  return (
    <ZeroCmsEntry entry={data}>
      <section className="bg-white border-b border-gray-300">
        <div className="mx-auto max-w-container px-6 py-8 sm:py-12">
          {/* One row: Trustpilot sits alongside the badges rather than above
              them. It wraps below `sm:` instead of forcing a scroll — the
              badges then wrap among themselves inside <ZeroCmsList>. */}
          <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6">
            {/* Trustpilot is a vendor iframe at a fixed font size, not an image
                — `logoSize` deliberately does not apply to it. Sizing it to the
                badges only ever added dead space under the ink, which is what
                made it look misaligned. It sizes itself; the row centres it. */}
            <TrustpilotWidget variant="mini" />

            <ZeroCmsList
              className="flex flex-wrap items-center justify-center gap-3 sm:gap-3.5"
              field="list"
              items={accreditations}
            >
              {accreditations.map((accreditation) =>
                accreditation ? (
                  <ZeroCmsEntry key={accreditation.id} entry={accreditation}>
                    <Accreditation data={accreditation} height={logoHeight} />
                  </ZeroCmsEntry>
                ) : null,
              )}
            </ZeroCmsList>
          </div>
        </div>
      </section>
    </ZeroCmsEntry>
  );
}
