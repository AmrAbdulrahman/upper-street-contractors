const GRAPHQL_TO_STRAPI_SINGULAR: Record<string, string> = {
  HomeHeaderSection: "home-header-section",
  WhoWeAreSection: "who-we-are-section",
  AccreditationList: "accreditation-list",
  WhatWeDoSection: "what-we-do-section",
  WhyChooseUsSection: "why-choose-us-section",
  HowItWorksSection: "how-it-works-section",
  RecentWorkSection: "recent-work-section",
  Button: "button",
  Badge: "badge",
  Banner: "banner",
  WorkCard: "work-card",
  ProjectCard: "project-card",
  AtAglance: "at-aglance",
  AtAglanceCard: "at-aglance-card",
  BulletList: "bullet-list",
  StaticStep: "static-step",
  Accreditation: "accreditation",
  ImageContainer: "image-container",
  Icon: "icon",
  MetaData: "meta-data",
  Page: "page",
  SiteMetaConfig: "site-meta-config",
  ReviewCard: "review-card",
  ClientReviewInfo: "client-review-info",
  SocialLink: "social-link",
  SectionRef: "section-ref",
};

const STRAPI_SINGLE_TYPES = new Set(["at-aglance"]);

export function graphqlTypenameToStrapiSingular(
  typename: string | null | undefined,
): string | null {
  if (!typename) return null;
  return GRAPHQL_TO_STRAPI_SINGULAR[typename] ?? null;
}

export function isStrapiSingleType(
  typename: string | null | undefined,
): boolean {
  const singular = graphqlTypenameToStrapiSingular(typename);
  return singular ? STRAPI_SINGLE_TYPES.has(singular) : false;
}

export function buildStrapiEntryUrl({
  strapiUrl = process.env.NEXT_PUBLIC_STRAPI_URL ?? "http://localhost:1337",
  documentId,
  typename,
  focusedField,
}: {
  strapiUrl?: string;
  documentId: string;
  typename?: string | null;
  focusedField?: string;
}): string {
  const baseUrl = strapiUrl.replace(/\/$/, "");
  const singular = graphqlTypenameToStrapiSingular(typename);
  if (!singular) {
    return `${baseUrl}/admin`;
  }

  const kind = isStrapiSingleType(typename)
    ? "single-types"
    : "collection-types";
  const path = `${baseUrl}/admin/content-manager/${kind}/api::${singular}.${singular}`;

  if (kind === "collection-types" && documentId) {
    const url = `${path}/${documentId}`;
    if (!focusedField) return url;
    const params = new URLSearchParams({ focusedField });
    return `${url}?${params.toString()}`;
  }

  if (!focusedField) return path;
  const params = new URLSearchParams({ focusedField });
  return `${path}?${params.toString()}`;
}
