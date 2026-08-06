import { NextResponse } from "next/server";
import { readFileSync } from "node:fs";
import path from "node:path";
import { getTransport } from "@/lib/email/transport";
import {
  renderConfirmationEmail,
  renderEnquiryEmail,
  type EnquiryField,
} from "@/lib/email/templates";
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
 * Brand logo for the email header, embedded as a `cid` attachment. Loaded once;
 * if the PNG can't be read the templates fall back to the text wordmark so email
 * never breaks. Regenerate with `node scripts/generate-email-logo.mjs`.
 */
const LOGO_ATTACHMENT = (() => {
  try {
    const p = path.join(process.cwd(), "public", "email-logo.png");
    return {
      filename: "logo.png",
      content: readFileSync(p),
      cid: "logo",
      contentType: "image/png",
    } as const;
  } catch {
    return null;
  }
})();

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
  // Greet with the first name only; the full name still appears in the details table.
  const senderName = fullName.split(/\s+/)[0] ?? "";

  const business = renderEnquiryEmail({
    fields,
    senderName,
    senderEmail,
    attachmentNames,
    hostedLinks,
    logoCid: LOGO_ATTACHMENT?.cid,
  });
  try {
    await transport.sendMail({
      from,
      to,
      replyTo: senderEmail && EMAIL_RE.test(senderEmail) ? senderEmail : undefined,
      subject: business.subject,
      html: business.html,
      attachments: LOGO_ATTACHMENT ? [...attachments, LOGO_ATTACHMENT] : attachments,
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
      senderName,
      attachmentNames,
      hostedLinks,
      logoCid: LOGO_ATTACHMENT?.cid,
    });
    try {
      await transport.sendMail({
        from,
        to: senderEmail,
        subject: confirmation.subject,
        html: confirmation.html,
        attachments: LOGO_ATTACHMENT ? [LOGO_ATTACHMENT] : undefined,
      });
    } catch (e) {
      console.error("enquiry: confirmation email failed", e);
    }
  }

  return NextResponse.json({ ok: true });
}
