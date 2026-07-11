import {
  type AccreditationListFragment,
  type CaseStudiesSectionFragment,
  type ClientReviewSectionFragment,
  type ClientsCarouselFragment,
  type ContactDetailsSectionFragment,
  type GoogleReviewsFragment,
  type HomeHeroSectionFragment,
  type HowItWorksSectionFragment,
  type PageHeroSectionFragment,
  type PlanningRenovationSectionFragment,
  type RecentWorkSectionFragment,
  type ServiceOfferSectionFragment,
  type SplitSectionFragment,
  type WhatWeDoSectionFragment,
  type WhoWeAreSectionFragment,
  type WhyChooseUsSectionFragment,
  type WizardSectionFragment,
} from "@/generated/graphql";
import { AccreditationList } from "./accreditation-list";
import { CaseStudiesSection } from "./case-studies";
import { ClientReviewsSection } from "./client-reviews";
import { ClientsCarousel } from "./clients-carousel";
import { ContactDetailsSection } from "./contact-details";
import { GoogleReviewsSection } from "./google-reviews";
import { HeroHeroSection } from "./home-hero";
import { HowItWorksSection } from "./how-it-works";
import { PageHeroSection } from "./page-hero";
import { PlanningRenovationSection } from "./planning-renovation";
import { RecentWorkSection } from "./recent-work";
import { ServiceOfferSection } from "./service-offer";
import { SplitSection } from "./split-section";
import { WhatWeDoSection } from "./what-we-do";
import { WhoWeAreSection } from "./who-we-are";
import { WhyChooseUsSection } from "./why-choose-us";
import { WizardSection } from "./wizard";

export type PageSectionData = (
  | AccreditationListFragment
  | CaseStudiesSectionFragment
  | ClientReviewSectionFragment
  | ClientsCarouselFragment
  | ContactDetailsSectionFragment
  | GoogleReviewsFragment
  | HomeHeroSectionFragment
  | HowItWorksSectionFragment
  | PageHeroSectionFragment
  | PlanningRenovationSectionFragment
  | RecentWorkSectionFragment
  | ServiceOfferSectionFragment
  | SplitSectionFragment
  | WhatWeDoSectionFragment
  | WhoWeAreSectionFragment
  | WhyChooseUsSectionFragment
  | WizardSectionFragment
) & { __typename?: string };

export function PageSection({ section }: { section: PageSectionData }) {
  switch (section.__typename) {
    case "PageHero":
      return <PageHeroSection data={section as PageHeroSectionFragment} />;

    case "Wizard":
      return <WizardSection data={section as WizardSectionFragment} />;

    case "ContactDetails":
      return (
        <ContactDetailsSection data={section as ContactDetailsSectionFragment} />
      );

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

    case "ClientsCarousel":
      return <ClientsCarousel data={section as ClientsCarouselFragment} />;

    case "PlanningRenovationSection":
      return (
        <PlanningRenovationSection
          data={section as PlanningRenovationSectionFragment}
        />
      );

    case "ServiceOfferSection":
      return (
        <ServiceOfferSection data={section as ServiceOfferSectionFragment} />
      );

    case "CaseStudiesSection":
      return (
        <CaseStudiesSection data={section as CaseStudiesSectionFragment} />
      );

    case "SplitSection":
      return <SplitSection data={section as SplitSectionFragment} />;

    case "GoogleReviews":
      return <GoogleReviewsSection data={section as GoogleReviewsFragment} />;

    default:
      return null;
  }
}
