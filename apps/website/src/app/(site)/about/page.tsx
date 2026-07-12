import { cache } from "react";
import type { Metadata } from "next";
import { PageSection, type PageSectionData } from "@/components/sections/page-section";
import { pageMetaToMetadata } from "@/components/metadata";
import { getSiteMetaConfig } from "@/components/site-meta-config";
import { GetPageDocument } from "@/generated/graphql";
import { query } from "@/lib/cms/query";
import { TrustpilotWidget } from "@/components/ui/trustpilot-widget";

const PAGE_KEY = "about-us";
const PAGE_PATH = "/about";

const getPage = cache(() => query(GetPageDocument, { key: PAGE_KEY }));

export async function generateMetadata(): Promise<Metadata> {
  try {
    const [siteMetaConfig, data] = await Promise.all([
      getSiteMetaConfig(),
      getPage(),
    ]);
    return pageMetaToMetadata(data?.pages?.at(0)?.meta, {
      path: PAGE_PATH,
      siteName: siteMetaConfig?.siteName ?? undefined,
    });
  } catch {
    const siteMetaConfig = await getSiteMetaConfig();

    return pageMetaToMetadata(null, {
      path: PAGE_PATH,
      siteName: siteMetaConfig?.siteName ?? undefined,
    });
  }
}

export default async function AboutPage() {
  const data = await getPage();
  const sections = data.pages[0]?.sections ?? [];

  // FAQ renders at the very bottom of the page, beneath the reviews block.
  const faqIndex = sections.findIndex(
    (s) => (s as { __typename?: string }).__typename === "Faq",
  );
  const faqSection = faqIndex >= 0 ? sections[faqIndex] : null;
  const aboveSections =
    faqIndex >= 0 ? sections.filter((_, i) => i !== faqIndex) : sections;

  return (
    <>
      {aboveSections.map((section, i) => (
        <PageSection key={i} section={section as PageSectionData} />
      ))}
      {/* Existing Trustpilot widgets kept below the hero (dev scaffolding — replace with real About sections later). */}
      <div className="mx-auto flex max-w-container flex-col gap-4 px-6 py-16">
        <TrustpilotWidget variant="mini" />
        <TrustpilotWidget variant="micro-combo" />
        <TrustpilotWidget variant="micro-review-count" />
        <TrustpilotWidget variant="review-collector" />
      </div>
      {faqSection ? (
        <PageSection section={faqSection as PageSectionData} />
      ) : null}
    </>
  );
}
