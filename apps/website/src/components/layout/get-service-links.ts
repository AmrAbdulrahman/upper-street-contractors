import { cache } from "react";
import { GetPageDocument } from "@/generated/graphql";
import { query } from "@/lib/cms/query";
import type { NavLink } from "@/components/layout/nav-links";

/**
 * The nine trades, read from the CMS instead of a hardcoded array.
 *
 * The source is the **Services index's own card grid**, not "every page that
 * has a slug". That is deliberate, and it is what `nav-links.ts` always
 * intended: the menu and `/services` are one list, so they cannot disagree
 * about what we do. It also gives an editor the order for free — the grid's
 * card order is the menu's order.
 *
 * (The sitemap and `generateStaticParams` use the other source, every page
 * carrying a Slug, because an unlisted Service page still resolves at its URL
 * and should still be crawlable. A card is a promotion; a slug is an address.)
 */
const SERVICES_PAGE_KEY = "services";

async function fetchServiceLinks(): Promise<NavLink[]> {
  try {
    // Not `cacheInInspect`: an editor who has just created a Service must see it
    // in the menu on the next refresh, and inspect reads are uncached anyway.
    const data = await query(GetPageDocument, { key: SERVICES_PAGE_KEY });

    const grid = (data?.pages?.at(0)?.sections ?? []).find(
      (section) => section?.__typename === "ServiceGridSection",
    );
    if (grid?.__typename !== "ServiceGridSection") return [];

    return (grid.cards ?? []).flatMap((card) => {
      const label = card?.title?.trim();
      const slug = card?.page?.slug?.trim();
      // A card with no page yet is half-created, not a broken link to render in
      // the header of every page on the site.
      if (!label || !slug) return [];
      return [{ label, href: `/${slug}` }];
    });
  } catch {
    // The header must render. A menu missing its dropdown is survivable; a
    // throw here takes down every page's chrome.
    return [];
  }
}

export const getServiceLinks = cache(fetchServiceLinks);
