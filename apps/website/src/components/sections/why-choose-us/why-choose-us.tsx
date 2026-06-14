import { AddStrapiEntry, StrapiEntry, StrapiEntryField } from "@/components/strapi";
import { BulletList } from "@/components/ui/bullet-list";
import { ProfileCard } from "@/components/ui/profile-card";
import { WhyChooseUsSectionFragment } from "@/generated/graphql";

type WhyChooseUsSectionProps = {
  data: WhyChooseUsSectionFragment;
};

export function WhyChooseUsSection({ data }: WhyChooseUsSectionProps) {
  const {
    overline,
    listOfPoints,
    cardImage,
    cardTitle,
    cardRole,
    cardParagraph,
    cardBanner,
  } = data;
  const bulletItems = listOfPoints?.filter(Boolean) ?? [];

  return (
    <StrapiEntry entry={data}>
      <section className="bg-white">
        <div className="mx-auto grid max-w-container gap-12 px-6 py-[88px] lg:grid-cols-2 lg:items-start lg:gap-x-[72px] lg:gap-y-12">
          <div className="min-w-0">
            {overline ? (
              <StrapiEntryField field="overline">
                <p className="mb-2.5 text-[11px] font-bold tracking-[0.12em] text-gold uppercase">
                  {overline}
                </p>
              </StrapiEntryField>
            ) : null}

            <h2 className="text-[clamp(26px,3.5vw,42px)] leading-tight text-dark">
              Why homeowners choose us
            </h2>

            {bulletItems.length > 0 ? (
              <ul className="mt-6 flex flex-col gap-3">
                {bulletItems.map((item) =>
                  item ? <BulletList key={item.documentId} data={item} /> : null,
                )}
                <AddStrapiEntry field="listOfPoints" />
              </ul>
            ) : null}
          </div>

          <div className="min-w-0">
            <ProfileCard
              image={cardImage}
              title={cardTitle}
              role={cardRole}
              paragraph={cardParagraph}
              banner={cardBanner}
              imageAlt={cardImage?.imgDescription ?? cardTitle ?? "Profile photo"}
            />
          </div>
        </div>
      </section>
    </StrapiEntry>
  );
}
