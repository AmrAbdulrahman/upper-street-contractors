/**
 * Local-dev-only preview of the two enquiry emails, so a template tweak can be
 * eyeballed without sending real mail. There is no test harness for this app —
 * `vitest.config.mts` covers `libs/*` only — so this is the fast feedback loop.
 *
 *   /api/dev/enquiry-preview                    both, side by side, with subjects
 *   /api/dev/enquiry-preview?kind=business      the copy the business receives
 *   /api/dev/enquiry-preview?kind=confirmation  the copy the sender receives
 *
 * Gated on NODE_ENV so it is inert everywhere it is deployed — including
 * staging, where a preview flag would still be on.
 */
import {
  renderConfirmationEmail,
  renderEnquiryEmail,
  type EnquiryField,
} from "@/lib/email/templates";
import { EMAIL_BADGES } from "@/lib/email/badges";
import type { HostedAttachment } from "@/helpers/enquiry-files";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * A real send embeds the artwork as `cid:` MIME parts, which a browser cannot
 * resolve. Point them at the same files under /public instead.
 */
const CID_TO_FILE: Record<string, string> = {
  logo: "email-logo.png",
  ...Object.fromEntries(EMAIL_BADGES.map((badge) => [badge.cid, badge.file])),
};

const SAMPLE_FIELDS: EnquiryField[] = [
  { label: "Name", value: "Ahmed Gaafer" },
  { label: "Email", value: "ahmed@example.com" },
  { label: "Phone", value: "07588 376345" },
  { label: "Project type", value: "Kitchen renovation" },
  { label: "Property", value: "Victorian terrace, N1" },
  { label: "Emergency", value: "No" },
  {
    label: "Availability",
    value: "Mon 14 Sep — 9am-1pm, 4pm-8pm\nThu 17 Sep — Any time",
  },
  {
    label: "Anything else",
    value:
      "Looking to knock through to the dining room.\nBudget is flexible for the right finish.",
  },
];

const SAMPLE_HOSTED: HostedAttachment[] = [
  {
    url: "https://example.public.blob.vercel-storage.com/media/site-walkthrough.mp4",
    name: "site-walkthrough.mp4",
    size: 48_500_000,
  },
];

function build(kind: string) {
  const common = {
    fields: SAMPLE_FIELDS,
    // Mirrors route.ts: the business is told the full name, the sender is
    // greeted by their first.
    senderName: kind === "business" ? "Ahmed Gaafer" : "Ahmed",
    attachmentNames: ["kitchen-plan.pdf", "current-layout.jpg"],
    hostedLinks: SAMPLE_HOSTED,
    logoCid: "logo",
    badgeCids: EMAIL_BADGES.map((badge) => badge.cid),
  };

  const email =
    kind === "business"
      ? renderEnquiryEmail({ ...common, senderEmail: "ahmed@example.com" })
      : renderConfirmationEmail(common);

  return {
    subject: email.subject,
    html: email.html.replace(/cid:([\w-]+)/g, (match, cid) =>
      CID_TO_FILE[cid] ? `/${CID_TO_FILE[cid]}` : match,
    ),
  };
}

function html(body: string) {
  return new Response(body, {
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

export async function GET(request: Request) {
  if (process.env.NODE_ENV !== "development") {
    return new Response("Not found", { status: 404 });
  }

  const kind = new URL(request.url).searchParams.get("kind");

  if (kind === "business" || kind === "confirmation") {
    const email = build(kind);
    return html(email.html);
  }

  // Both at once, each under its real subject line — the subjects are half of
  // what there is to check here.
  const panels = (["business", "confirmation"] as const)
    .map((k) => {
      const { subject } = build(k);
      return `
        <section>
          <h2>${k === "business" ? "Business receives" : "Sender receives"}</h2>
          <p><strong>Subject:</strong> <code>${subject}</code></p>
          <iframe src="?kind=${k}" title="${k} email"></iframe>
        </section>`;
    })
    .join("");

  return html(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Enquiry email preview</title>
    <style>
      body { margin: 0; padding: 24px; font: 14px/1.5 system-ui, sans-serif; background: #1b1b1b; color: #eee; }
      h1 { font-size: 18px; margin: 0 0 20px; }
      .grid { display: flex; flex-wrap: wrap; gap: 24px; align-items: flex-start; }
      section { flex: 1 1 620px; min-width: 0; }
      h2 { font-size: 14px; text-transform: uppercase; letter-spacing: .08em; color: #9ab; margin: 0 0 6px; }
      p { margin: 0 0 10px; }
      code { background: #000; padding: 2px 6px; border-radius: 4px; }
      iframe { width: 100%; height: 1100px; border: 0; border-radius: 10px; background: #fff; }
    </style>
  </head>
  <body>
    <h1>Enquiry email preview <small>(dev only)</small></h1>
    <div class="grid">${panels}</div>
  </body>
</html>`);
}
