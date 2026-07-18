import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/ui/placeholder-page";

// Static (the page is a stub with no CMS entry); the root layout's
// `%s | Upper Street Contractors` title template applies.
export const metadata: Metadata = {
  title: "Rates",
  description:
    "Rates for building, refurbishment, plumbing, electrical and handyman work by Upper Street Contractors in Islington, North London.",
  alternates: { canonical: "/rates" },
};

export default function RatesPage() {
  return <PlaceholderPage title="Rates" />;
}
