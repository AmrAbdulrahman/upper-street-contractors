import { NextResponse } from "next/server";
import { readFileSync } from "node:fs";
import path from "node:path";
import { getTransport } from "@/lib/email/transport";
import {
  renderConfirmationEmail,
  renderEnquiryEmail,
  type EnquiryField,
} from "@/lib/email/templates";
import { EMAIL_BADGES } from "@/lib/email/badges";
import {
  ENQUIRY_INLINE_BUDGET_BYTES,
  formatBytes,
  sanitizeHostedAttachments,
  validateEnquiryFiles,
  type HostedAttachment,
} from "@/helpers/enquiry-files";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Artwork embedded in both emails as `cid` attachments, read once at module
 * load. Anything that can't be read is simply left out rather than throwing:
 * a missing header logo falls back to the text wordmark, and a missing trust
 * mark drops that one badge. Email never breaks over a file.
 *
 * Regenerate the files with `node scripts/generate-email-logo.mjs` and
 * `node scripts/generate-email-badges.mjs` (both run from apps/website).
 */
function readEmailAsset(file: string, cid: string, filename = file) {
  try {
    return {
      filename,
      content: readFileSync(path.join(process.cwd(), "public", file)),
      cid,
      contentType: "image/png",
    };
  } catch {
    return null;
  }
}

const LOGO_ATTACHMENT = readEmailAsset("email-logo.png", "logo", "logo.png");
const BADGE_ATTACHMENTS = EMAIL_BADGES.map((badge) =>
  readEmailAsset(badge.file, badge.cid),
).filter((asset) => asset !== null);

/** Which trust marks the templates may reference — only the ones that loaded. */
const BADGE_CIDS = BADGE_ATTACHMENTS.map((asset) => asset.cid);

/** Rides every message, alongside whatever the visitor attached. */
const BRAND_ATTACHMENTS = LOGO_ATTACHMENT
  ? [LOGO_ATTACHMENT, ...BADGE_ATTACHMENTS]
  : BADGE_ATTACHMENTS;

type Payload = {
  fields?: EnquiryField[];
  senderEmail?: string;
  senderName?: string;
  /**
   * Attachments the browser uploaded straight to Vercel Blob because they did
   * not fit the inline budget (ADR 0014). Untrusted — every URL is re-checked
   * against our own Blob host before it reaches an email body.
   */
  hostedLinks?: unknown;
};

export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form submission." }, { status: 400 });
  }

  // Honeypot — bots that fill hidden fields are silently accepted.
  const honeypot = form.get("company_website");
  if (typeof honeypot === "string" && honeypot.trim() !== "") {
    return NextResponse.json({ ok: true });
  }

  const raw = form.get("payload");
  let payload: Payload;
  try {
    payload = JSON.parse(typeof raw === "string" ? raw : "{}");
  } catch {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  const fields: EnquiryField[] = Array.isArray(payload.fields)
    ? payload.fields.filter(
        (f): f is EnquiryField =>
          !!f && typeof f.label === "string" && typeof f.value === "string",
      )
    : [];

  if (fields.length === 0) {
    return NextResponse.json({ error: "Your enquiry looks empty." }, { status: 400 });
  }

  // Any file type is accepted (see helpers/enquiry-files.ts) — the caps are the
  // contract, and a direct POST is bounded by the same ones the wizard applies.
  const uploaded = form
    .getAll("attachments")
    .filter((v): v is File => v instanceof File && v.size > 0);
  const hostedLinks: HostedAttachment[] = sanitizeHostedAttachments(
    payload.hostedLinks,
  );

  // Same caps the wizard applies, re-run over the whole set — a direct POST
  // skips the client entirely. Hosted sizes are self-reported, so the real
  // per-file bound for those is `maximumSizeInBytes` on the Blob upload token.
  const capProblem = validateEnquiryFiles([
    ...uploaded.map((f) => ({ name: f.name, size: f.size })),
    ...hostedLinks,
  ]);
  if (capProblem) {
    return NextResponse.json({ error: capProblem }, { status: 400 });
  }
  // Only the inline set rides this request, so it is the only thing bounded
  // here — anything larger should already have gone to Blob.
  if (uploaded.reduce((sum, f) => sum + f.size, 0) > ENQUIRY_INLINE_BUDGET_BYTES) {
    return NextResponse.json(
      {
        error: `Emailed attachments must total under ${formatBytes(ENQUIRY_INLINE_BUDGET_BYTES)}. Larger files are uploaded separately.`,
      },
      { status: 400 },
    );
  }

  const to = process.env.ENQUIRY_TO;
  const from = process.env.ENQUIRY_FROM || process.env.SMTP_USER;
  if (!to || !from) {
    return NextResponse.json(
      { error: "Email recipient is not configured." },
      { status: 500 },
    );
  }

  let transport;
  try {
    transport = getTransport();
  } catch {
    return NextResponse.json(
      { error: "Email service is not configured." },
      { status: 500 },
    );
  }

  const attachments = await Promise.all(
    uploaded.map(async (file) => ({
      filename: file.name,
      content: Buffer.from(await file.arrayBuffer()),
      contentType: file.type || "application/octet-stream",
    })),
  );
  const attachmentNames = uploaded.map((f) => f.name);

  const senderEmail =
    typeof payload.senderEmail === "string" ? payload.senderEmail.trim() : "";
  const fullName =
    typeof payload.senderName === "string" ? payload.senderName.trim() : "";
  // The sender's own copy greets them by first name. The business's copy names
  // them in full — it has no greeting, and a subject line has to stay scannable
  // in a busy inbox.
  const firstName = fullName.split(/\s+/)[0] ?? "";

  const business = renderEnquiryEmail({
    fields,
    senderName: fullName,
    senderEmail,
    attachmentNames,
    hostedLinks,
    logoCid: LOGO_ATTACHMENT?.cid,
    badgeCids: BADGE_CIDS,
  });
  try {
    await transport.sendMail({
      from,
      to,
      replyTo: senderEmail && EMAIL_RE.test(senderEmail) ? senderEmail : undefined,
      subject: business.subject,
      html: business.html,
      attachments: [...attachments, ...BRAND_ATTACHMENTS],
    });
  } catch (e) {
    console.error("enquiry: business email failed", e);
    return NextResponse.json(
      { error: "We couldn't send your enquiry. Please try again, or call us." },
      { status: 502 },
    );
  }

  // Confirmation to the sender is best-effort — don't fail the request if it bounces.
  if (senderEmail && EMAIL_RE.test(senderEmail)) {
    const confirmation = renderConfirmationEmail({
      fields,
      senderName: firstName,
      attachmentNames,
      hostedLinks,
      logoCid: LOGO_ATTACHMENT?.cid,
      badgeCids: BADGE_CIDS,
    });
    try {
      await transport.sendMail({
        from,
        to: senderEmail,
        subject: confirmation.subject,
        html: confirmation.html,
        attachments: BRAND_ATTACHMENTS,
      });
    } catch (e) {
      console.error("enquiry: confirmation email failed", e);
    }
  }

  return NextResponse.json({ ok: true });
}
