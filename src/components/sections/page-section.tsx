import {
  type HomeHeroSectionFragment,
  type WhoWeAreSectionFragment,
} from "@/generated/graphql";
import { HeroHeroSection } from "./home-hero";
import { WhoWeAreSection } from "./who-we-are";

export type PageSectionData =
  | HomeHeroSectionFragment
  | WhoWeAreSectionFragment;

export function PageSection({ section }: { section: PageSectionData }) {
  switch (section.__typename) {
    case "HomeHeaderSection":
      return <HeroHeroSection data={section} />;

    case "WhoWeAreSection":
      return <WhoWeAreSection data={section} />;

    default:
      return null;
  }
}
