import { ZeroCmsEntryProvider, ZeroCmsSectionList } from "@usc/zero-cms-widget";
import { PageSection, type PageSectionData } from "./page-section";

/**
 * Renders a CMS page's `sections`, wrapped so an editor can build the page in
 * inspect mode — insert a section at any position, remove one, drag to reorder.
 *
 * Every route used to inline `sections.map(...)` itself, which meant sections
 * could be edited but never added, removed or reordered anywhere on the site.
 * One component instead of fourteen copies, so the next change lands once.
 *
 * `ZeroCmsEntryProvider`, not `<ZeroCmsEntry>`: the builder needs the page's id
 * and type in context, but an `<ZeroCmsEntry>` would also draw a hover outline
 * and pencil around the ENTIRE page, swallowing each section's own affordance.
 *
 * Outside inspect mode `ZeroCmsSectionList` renders its children verbatim — no
 * wrapper element, no classes — so a public page is byte-identical to before.
 */

/** Structural, so any page-shaped GraphQL selection matches. */
type SectionsHost = {
  id?: string | null;
  type?: string | null;
  sections?: ReadonlyArray<unknown> | null;
};

export function PageSections({ page }: { page: SectionsHost | null | undefined }) {
  if (!page) return null;
  const sections = page.sections ?? [];

  return (
    <ZeroCmsEntryProvider entry={page}>
      <ZeroCmsSectionList field="sections" items={sections}>
        {sections.map((section, i) => (
          <PageSection key={i} section={section as PageSectionData} />
        ))}
      </ZeroCmsSectionList>
    </ZeroCmsEntryProvider>
  );
}
