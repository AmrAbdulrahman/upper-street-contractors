import { NextResponse } from "next/server";
import { readFileSync } from "node:fs";
import path from "node:path";
import { getTransport } from "@/lib/email/transport";
import {
  renderConfirmationEmail,
  renderEnquiryEmail,
  type EnquiryField,
} from "@/lib/email/templates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_FILES = 5;
const MAX_TOTAL_BYTES = 10 * 1024 * 1024; // 10 MB
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

  const uploaded = form
    .getAll("attachments")
    .filter((v): v is File => v instanceof File && v.size > 0);

  if (uploaded.length > MAX_FILES) {
    return NextResponse.json(
      { error: `Please attach at most ${MAX_FILES} files.` },
      { status: 400 },
    );
  }
  if (uploaded.reduce((sum, f) => sum + f.size, 0) > MAX_TOTAL_BYTES) {
    return NextResponse.json(
      { error: "Attachments must total under 10 MB." },
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
  const senderName =
    typeof payload.senderName === "string" ? payload.senderName.trim() : "";

  const business = renderEnquiryEmail({
    fields,
    senderName,
    senderEmail,
    attachmentNames,
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
