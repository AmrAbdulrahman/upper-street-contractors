import { cache } from "react";
import { GetHomePageDocument, type GetHomePageQuery } from "@/generated/graphql";
import { strapiRead } from "@/lib/strapi-read";

/**
 * Request-memoised home-page read. generateMetadata, the page body, and the
 * nested AtAGlance component all call this, so the merged GetHomePage query
 * (page sections + atAglance) costs a single network call per request.
 */
export const getHomePage = cache(() =>
  strapiRead<GetHomePageQuery>(GetHomePageDocument),
);
