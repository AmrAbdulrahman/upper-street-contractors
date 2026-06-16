import {
  type AccreditationListFragment,
  type ClientReviewSectionFragment,
  type HomeHeroSectionFragment,
  type HowItWorksSectionFragment,
  type PlanningRenovationSectionFragment,
  type RecentWorkSectionFragment,
  type WhatWeDoSectionFragment,
  type WhoWeAreSectionFragment,
  type WhyChooseUsSectionFragment,
} from "@/generated/graphql";
import { AccreditationList } from "./accreditation-list";
import { ClientReviewsSection } from "./client-reviews";
import { HeroHeroSection } from "./home-hero";
import { HowItWorksSection } from "./how-it-works";
import { PlanningRenovationSection } from "./planning-renovation";
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
  | ClientReviewSectionFragment
  | PlanningRenovationSectionFragment
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

    case "ClientReviewSection":
      return (
        <ClientReviewsSection data={section as ClientReviewSectionFragment} />
      );

    case "PlanningRenovationSection":
      return (
        <PlanningRenovationSection
          data={section as PlanningRenovationSectionFragment}
        />
      );

    default:
      return null;
  }
}
