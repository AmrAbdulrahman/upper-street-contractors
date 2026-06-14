import {
  type AccreditationListFragment,
  type HomeHeroSectionFragment,
  type HowItWorksSectionFragment,
  type RecentWorkSectionFragment,
  type WhatWeDoSectionFragment,
  type WhoWeAreSectionFragment,
  type WhyChooseUsSectionFragment,
} from "@/generated/graphql";
import { AccreditationList } from "./accreditation-list";
import { HeroHeroSection } from "./home-hero";
import { HowItWorksSection } from "./how-it-works";
import { RecentWorkSection } from "./recent-work";
import { WhatWeDoSection } from "./what-we-do";
import { WhoWeAreSection } from "./who-we-are";
import { WhyChooseUsSection } from "./why-choose-us";

export type PageSectionData = (
  | AccreditationListFragment
  | HomeHeroSectionFragment
  | WhatWeDoSectionFragment
  | WhoWeAreSectionFragment
  | WhyChooseUsSectionFragment
  | HowItWorksSectionFragment
  | RecentWorkSectionFragment
) & { __typename?: string };

export function PageSection({ section }: { section: PageSectionData }) {
  switch (section.__typename) {
    case "HomeHeaderSection":
      return <HeroHeroSection data={section as HomeHeroSectionFragment} />;

    case "WhoWeAreSection":
      return <WhoWeAreSection data={section as WhoWeAreSectionFragment} />;

    case "WhatWeDoSection":
      return <WhatWeDoSection data={section as WhatWeDoSectionFragment} />;

    case "AccreditationList":
      return <AccreditationList data={section as AccreditationListFragment} />;

    case "WhyChooseUsSection":
      return <WhyChooseUsSection data={section as WhyChooseUsSectionFragment} />;

    case "HowItWorksSection":
      return <HowItWorksSection data={section as HowItWorksSectionFragment} />;

    case "RecentWorkSection":
      return <RecentWorkSection data={section as RecentWorkSectionFragment} />;

    default:
      return null;
  }
}
