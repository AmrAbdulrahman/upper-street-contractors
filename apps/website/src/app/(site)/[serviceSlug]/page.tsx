import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ZeroCmsEntryProvider } from "@usc/zero-cms-widget";
import { PageSections } from "@/components/sections/page-sections";
import { ServicePageActions, type ServiceGridRef } from "@/components/sections/service-grid";
import {
  BreadcrumbJsonLd,
  NOT_FOUND_METADATA,
  ServiceJsonLd,
  pageMetaToMetadata,
} from "@/components/metadata";
import { getSiteMetaConfig } from "@/components/site-meta-config";
import {
  GetPageBySlugDocument,
  GetServiceGridDocument,
  GetServicePageSlugsDocument,
} from "@/generated/graphql";
import { isPreview } from "@/lib/app-env";
import { query } from "@/lib/cms/query";

/**
 * Every Service page, from one route.
 *
 * This replaced nine near-identical files (`kitchens/page.tsx`,
 * `bathrooms/page.tsx`, …) that differed only in two constants. That was
 * survivable while the nine were fixed, but it made a Service the one kind of
 * content an editor could not create: a new one needed a route file, so a
 * "New service" button could only ever produce a card pointing at a 404.
 *
 * Resolution is by the page's own **Slug**, not its `key`. `key` is an opaque
 * internal handle (`kitchen-installations-service`) that route code hardcoded
 * and that says nothing about the URL; the slug IS the URL, and lives on the
 * entry where an editor can set it.
 *
 * Safe at the root of `(site)` because Next resolves static segments before
 * dynamic ones: `/blog`, `/projects`, `/services`, `/about`, `/contact`,
 * `/rates` and the legal pages all still win. Anything else falls here and
 * 404s unless a page claims that slug.
 */

type ServicePageProps = {
  params: Promise<{ serviceSlug: string }>;
};

const getPage = cache((slug: string) => query(GetPageBySlugDocument, { slug }));

/**
 * The Services index's card grid, for the page's own Duplicate — a Service is
 * this page plus the card that links to it, and a copy with no card is a page
 * nobody can reach.
 *
 * Only read in Draft Mode: it exists for editing chrome, and a public request
 * has no use for a second page's sections.
 */
async function getServiceGrid(): Promise<ServiceGridRef | null> {
  if (!(await isPreview())) return null;
  const data = await query(GetServiceGridDocument, {});
  for (const section of data?.pages?.at(0)?.sections ?? []) {
    if (section?.__typename === "ServiceGridSection")
      return { id: section.id, type: section.type };
  }
  return null;
}

export async function generateStaticParams() {
  const data = await query(GetServicePageSlugsDocument);
  // De-duplicated: zero-cms enforces no uniqueness on `slug`, and two params
  // with the same value would make Next build the same route twice.
  const slugs = new Set(
    (data?.pages ?? [])
      .map((page) => page?.slug?.trim())
      .filter((slug): slug is string => Boolean(slug)),
  );
  return [...slugs].map((serviceSlug) => ({ serviceSlug }));
}

export async function generateMetadata({
  params,
}: ServicePageProps): Promise<Metadata> {
  const { serviceSlug } = await params;
  const [siteMetaConfig, data] = await Promise.all([
    getSiteMetaConfig(),
    getPage(serviceSlug),
  ]);

  const page = data?.pages?.at(0);
  // An unknown slug gets the Not Found head, not a generic one: a real title
  // and the site's `index, follow` on a page with no content is the soft-404
  // signal. Same rule as blog/[slug] and projects/[id].
  //
  // `notFound()` used to be thrown here as well as in the component below.
  // It is the component's job alone now — see NOT_FOUND_METADATA for why the
  // head has to say `noindex` rather than inherit and be contradicted.
  if (!page) return NOT_FOUND_METADATA;

  return pageMetaToMetadata(page.meta, {
    path: `/${serviceSlug}`,
    config: siteMetaConfig,
  });
}

export default async function ServicePage({ params }: ServicePageProps) {
  const { serviceSlug } = await params;
  const [siteMetaConfig, data, grid] = await Promise.all([
    getSiteMetaConfig(),
    getPage(serviceSlug),
    getServiceGrid(),
  ]);
  const page = data?.pages?.at(0);

  if (!page) notFound();

  return (
    <>
      <ServiceJsonLd
        name={page.title}
        description={page.meta?.description}
        slug={serviceSlug}
        config={siteMetaConfig}
      />
      <BreadcrumbJsonLd
        config={siteMetaConfig}
        trail={[
          { name: "Services", path: "/services" },
          { name: page.title ?? "Service" },
        ]}
      />
      {/* Provider only around the actions row: <PageSections> mounts its own
          for the Section builder, and the row needs the page in context to know
          what it is publishing. Renders nothing outside edit mode. */}
      <ZeroCmsEntryProvider entry={page}>
        <div className="mx-auto max-w-container px-6 pt-6 empty:hidden">
          <ServicePageActions title={page.title} grid={grid} />
        </div>
      </ZeroCmsEntryProvider>

      <PageSections page={page} />
    </>
  );
}
