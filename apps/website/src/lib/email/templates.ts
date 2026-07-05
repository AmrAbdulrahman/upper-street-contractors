/**
 * Branded, inline-styled HTML emails for the Enquiry Wizard. Table-based
 * layout for broad email-client support; colours mirror the site tokens.
 */

const SITE = "Upper Street Contractors";
const BRAND = {
  dark: "#1b2638",
  gold: "#b8863a",
  surface: "#f8f5f0",
  border: "#e4ddd4",
  muted: "#4a5568",
  subtle: "#8a94a6",
  white: "#ffffff",
};

export type EnquiryField = { label: string; value: string };

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function rowsHtml(fields: EnquiryField[]): string {
  return fields
    .map(
      (f) => `
      <tr>
        <td style="padding:11px 16px;border-bottom:1px solid ${BRAND.border};font-size:12px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:${BRAND.muted};vertical-align:top;white-space:nowrap;">${escapeHtml(f.label)}</td>
        <td style="padding:11px 16px;border-bottom:1px solid ${BRAND.border};font-size:15px;line-height:1.5;color:${BRAND.dark};">${escapeHtml(f.value).replace(/\n/g, "<br>")}</td>
      </tr>`,
    )
    .join("");
}

function layout(opts: {
  heading: string;
  intro: string;
  fields: EnquiryField[];
  note?: string;
}): string {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:${BRAND.surface};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.surface};padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:${BRAND.white};border-radius:16px;overflow:hidden;border:1px solid ${BRAND.border};">
            <tr>
              <td style="background:${BRAND.dark};padding:26px 30px;">
                <div style="font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:${BRAND.gold};font-weight:700;">${SITE}</div>
                <div style="font-family:Georgia,'Times New Roman',serif;font-size:23px;color:${BRAND.white};margin-top:6px;">${escapeHtml(opts.heading)}</div>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 30px 6px;font-size:15px;line-height:1.6;color:${BRAND.muted};">${escapeHtml(opts.intro)}</td>
            </tr>
            <tr>
              <td style="padding:10px 16px 20px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${BRAND.border};border-radius:12px;overflow:hidden;">
                  ${rowsHtml(opts.fields)}
                </table>
              </td>
            </tr>
            ${opts.note ? `<tr><td style="padding:0 30px 24px;font-size:13px;color:${BRAND.subtle};">${escapeHtml(opts.note)}</td></tr>` : ""}
            <tr>
              <td style="background:${BRAND.surface};padding:16px 30px;font-size:12px;color:${BRAND.subtle};text-align:center;">© ${SITE}</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export function renderEnquiryEmail(opts: {
  fields: EnquiryField[];
  senderName: string;
  senderEmail: string;
  attachmentNames: string[];
}): { subject: string; html: string } {
  const who = opts.senderName || opts.senderEmail || "a website visitor";
  const note = opts.attachmentNames.length
    ? `Attachments: ${opts.attachmentNames.join(", ")}`
    : undefined;
  return {
    subject: `New enquiry${opts.senderName ? ` from ${opts.senderName}` : ""}`,
    html: layout({
      heading: "New website enquiry",
      intro: `You've received a new enquiry from ${who}. The details are below.`,
      fields: opts.fields,
      note,
    }),
  };
}

export function renderConfirmationEmail(opts: {
  fields: EnquiryField[];
  senderName: string;
  attachmentNames: string[];
}): { subject: string; html: string } {
  const note = opts.attachmentNames.length
    ? `You attached: ${opts.attachmentNames.join(", ")}`
    : undefined;
  return {
    subject: `We've received your enquiry — ${SITE}`,
    html: layout({
      heading: "Thanks — we've got your enquiry",
      intro: `Hi${opts.senderName ? ` ${opts.senderName}` : ""}, thanks for getting in touch. Here's a copy of what you sent — we'll be in touch shortly.`,
      fields: opts.fields,
      note,
    }),
  };
}
