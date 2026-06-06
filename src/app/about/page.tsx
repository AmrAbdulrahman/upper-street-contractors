import { TrustpilotWidget } from "@/components/ui/trustpilot-widget";

export default function AboutPage() {
  return (
    <div>
      <h1>About Us</h1>
      <TrustpilotWidget  variant="mini" />
      <hr className="my-4" />
      <TrustpilotWidget  variant="micro-combo" />
      <hr className="my-4" />
      <TrustpilotWidget variant="micro-review-count" />
      <hr className="my-4" />
      <TrustpilotWidget variant="review-collector" />
    </div>
  );
}
