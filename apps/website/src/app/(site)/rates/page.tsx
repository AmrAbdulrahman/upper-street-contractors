import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/ui/placeholder-page";

// Static (the page is a stub with no CMS entry); the root layout's
// `%s | Upper Street Contractors` title template applies.
//
// `index: false` until the rate card, minimum charge, increments, out-of-hours
// and travel/parking terms are real content: an indexed page about our prices
// that does not state a price is the worst possible search result to own.
// `follow: true` — the onward links are good ones. It is also absent from
// `STATIC_ROUTES`, so it is not submitted in the sitemap either.
export const metadata: Metadata = {
  title: "Rates",
  description:
    "Rates for building, refurbishment, plumbing, electrical and handyman work by Upper Street Contractors in Islington, North London.",
  alternates: { canonical: "/rates" },
  robots: { index: false, follow: true },
};

export default function RatesPage() {
  return (
    <PlaceholderPage
      title="Rates"
      summary="How we charge for hourly and responsive work — the rate, the minimum charge, how time is counted, and what happens outside normal hours."
    />
  );
}
