import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/ui/placeholder-page";

// Static (the page is a stub with no CMS entry); the root layout's
// `%s | Upper Street Contractors` title template applies.
export const metadata: Metadata = {
  title: "Repairs & Smaller Works",
  description:
    "Repairs, odd jobs and smaller works — fast, tidy fixes around the home by Upper Street Contractors in Islington, North London.",
  alternates: { canonical: "/repairs-and-smaller-works" },
};

export default function RepairsAndSmallerWorksPage() {
  return <PlaceholderPage title="Repairs & Smaller Works" />;
}
