import {
  type AccreditationListFragment,
  type CaseStudiesSectionFragment,
  type ClientReviewSectionFragment,
  type ClientsCarouselFragment,
  type ContactDetailsSectionFragment,
  type FaqSectionFragment,
  type GallerySectionFragment,
  type GoogleReviewsFragment,
  type ImageSectionFragment,
  type HomeHeroSectionFragment,
  type HowItWorksSectionFragment,
  type PageHeroSectionFragment,
  type PlanningRenovationSectionFragment,
  type ProjectScopeSectionFragment,
  type ProjectTimelineSectionFragment,
  type ProseSectionFragment,
  type QuoteSectionFragment,
  type RecentWorkSectionFragment,
  type SeparatorSectionFragment,
  type ServiceGridSectionFragment,
  type ServiceOfferSectionFragment,
  type SplitSectionFragment,
  type StoryTimelineSectionFragment,
  type ValuesSectionFragment,
  type WhatWeDoSectionFragment,
  type WhoWeAreSectionFragment,
  type WhyChooseUsSectionFragment,
  type WizardSectionFragment,
} from "@/generated/graphql";
import { AccreditationList } from "./accreditation-list";
import { CaseStudiesSection } from "./case-studies";
import { ClientReviewsSection } from "./client-reviews";
import { ClientsCarousel } from "./clients-carousel";
import { ContactDetailsSection } from "./contact-details/contact-details-section";
import { FaqSection } from "./faq";
import { GallerySection } from "./gallery-section";
import { GoogleReviewsSection } from "./google-reviews";
import { HeroHeroSection } from "./home-hero";
import { HowItWorksSection } from "./how-it-works";
import { ImageSection } from "./image-section";
import { PageHeroSection } from "./page-hero";
import { PlanningRenovationSection } from "./planning-renovation";
import { ProjectScopeSection } from "./project-scope-section";
import { ProjectTimelineSection } from "./project-timeline-section";
import { ProseSection } from "./prose-section";
import { QuoteSection } from "./quote-section";
import { RecentWorkSection } from "./recent-work";
import { SeparatorSection } from "./separator-section";
import { ServiceGridSection } from "./service-grid";
import { ServiceOfferSection } from "./service-offer";
import { SplitSection } from "./split-section";
import { StoryTimelineSection } from "./story-timeline-section";
import { ValuesSection } from "./values-section";
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
  | FaqSectionFragment
  | GallerySectionFragment
  | GoogleReviewsFragment
  | ImageSectionFragment
  | HomeHeroSectionFragment
  | HowItWorksSectionFragment
  | PageHeroSectionFragment
  | PlanningRenovationSectionFragment
  | ProjectScopeSectionFragment
  | ProjectTimelineSectionFragment
  | ProseSectionFragment
  | QuoteSectionFragment
  | RecentWorkSectionFragment
  | SeparatorSectionFragment
  | ServiceGridSectionFragment
  | ServiceOfferSectionFragment
  | SplitSectionFragment
  | StoryTimelineSectionFragment
  | ValuesSectionFragment
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

    case "ServiceGridSection":
      return (
        <ServiceGridSection data={section as ServiceGridSectionFragment} />
      );

    case "CaseStudiesSection":
      return (
        <CaseStudiesSection data={section as CaseStudiesSectionFragment} />
      );

    case "SplitSection":
      return <SplitSection data={section as SplitSectionFragment} />;

    case "ProseSection":
      return <ProseSection data={section as ProseSectionFragment} />;

    case "StoryTimelineSection":
      return (
        <StoryTimelineSection data={section as StoryTimelineSectionFragment} />
      );

    case "ValuesSection":
      return <ValuesSection data={section as ValuesSectionFragment} />;

    // Project-only, and allowed only on `project.sections` — a page's Type
    // picker never offers them, so these two cases are unreachable from a page
    // and harmless there.
    case "ProjectScopeSection":
      return (
        <ProjectScopeSection data={section as ProjectScopeSectionFragment} />
      );

    case "ProjectTimelineSection":
      return (
        <ProjectTimelineSection data={section as ProjectTimelineSectionFragment} />
      );

    case "GoogleReviews":
      return <GoogleReviewsSection data={section as GoogleReviewsFragment} />;

    case "Faq":
      return <FaqSection data={section as FaqSectionFragment} />;

    case "ImageSection":
      return <ImageSection data={section as ImageSectionFragment} />;

    case "GallerySection":
      return <GallerySection data={section as GallerySectionFragment} />;

    case "QuoteSection":
      return <QuoteSection data={section as QuoteSectionFragment} />;

    case "SeparatorSection":
      return <SeparatorSection data={section as SeparatorSectionFragment} />;

    default:
      return null;
  }
}
