import {
  AddStrapiEntry,
  StrapiEntry,
} from "@/components/strapi";
import { Accreditation } from "@/components/ui/accreditation";
import { TrustpilotWidget } from "@/components/ui/trustpilot-widget";
import { AccreditationListFragment } from "@/generated/graphql";

type AccreditationListProps = {
  data: AccreditationListFragment;
};

export function AccreditationList({ data }: AccreditationListProps) {
  const accreditations = data.list?.filter(Boolean) ?? [];

  return (
    <StrapiEntry entry={data}>
      <section className="bg-white border-b border-gray-300">
        <div className="mx-auto flex max-w-container flex-col items-center gap-4 px-6 py-8 sm:gap-6 sm:py-12">
          <div className=" w-full justify-center flex">
            <TrustpilotWidget variant="mini" />
          </div>

          {accreditations.length > 0 ? (
            <div className="mx-auto flex w-full max-w-xs flex-col gap-3 sm:max-w-none sm:flex-row sm:flex-wrap sm:items-center sm:justify-center sm:gap-3.5">
              {accreditations.map((accreditation) =>
                accreditation ? (
                  <StrapiEntry
                    key={accreditation.documentId}
                    entry={accreditation}
                  >
                    <Accreditation data={accreditation} />
                  </StrapiEntry>
                ) : null,
              )}

              <AddStrapiEntry field="list" />
            </div>
          ) : (
            <AddStrapiEntry field="list" />
          )}
        </div>
      </section>
    </StrapiEntry>
  );
}
