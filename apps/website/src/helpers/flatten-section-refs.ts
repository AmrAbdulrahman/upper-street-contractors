import type { GetHomePageQuery } from "@/generated/graphql";
import type { PageSectionData } from "@/components/sections/page-section";

type SectionRef = NonNullable<
  NonNullable<GetHomePageQuery["pages"]>[number]["section_refs"]
>[number];

export function flattenSectionRefs(
  sectionRefs: SectionRef[] | null | undefined,
): PageSectionData[] {
  if (!sectionRefs?.length) return [];

  return sectionRefs
    .map((ref) => {
      const section =
        ref.home_hero_section ??
        ref.who_we_are_section ??
        ref.accreditation_list ??
        ref.what_we_do_section ??
        ref.why_choose_us_section ??
        ref.how_it_works_section ??
        ref.recent_work_section ??
        ref.client_review_section ??
        ref.planning_renovation_section ??
        null;

      return section as PageSectionData | null;
    })
    .filter((section): section is PageSectionData => Boolean(section));
}
