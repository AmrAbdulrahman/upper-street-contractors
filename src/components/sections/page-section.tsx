import {
  type AccreditationListFragment,
  type HomeHeroSectionFragment,
  type WhatWeDoSectionFragment,
  type WhoWeAreSectionFragment,
  type WhyChooseUsSectionFragment,
} from "@/generated/graphql";
import { AccreditationList } from "./accreditation-list";
import { HeroHeroSection } from "./home-hero";
import { WhatWeDoSection } from "./what-we-do";
import { WhoWeAreSection } from "./who-we-are";
import { WhyChooseUsSection } from "./why-choose-us";

export type PageSectionData =
  | AccreditationListFragment
  | HomeHeroSectionFragment
  | WhatWeDoSectionFragment
  | WhoWeAreSectionFragment
  | WhyChooseUsSectionFragment;

export function PageSection({ section }: { section: PageSectionData }) {
  switch (section.__typename) {
    case "HomeHeaderSection":
      return <HeroHeroSection data={section} />;

    case "WhoWeAreSection":
      return <WhoWeAreSection data={section} />;

    case "WhatWeDoSection":
      return <WhatWeDoSection data={section} />;

    case "AccreditationList":
      return <AccreditationList data={section} />;

    case "WhyChooseUsSection":
      return <WhyChooseUsSection data={section} />;

    default:
      return null;
  }
}
