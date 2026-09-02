/**
 * Branded, inline-styled HTML emails for the Enquiry Wizard. Table-based
 * layout for broad email-client support; colours mirror the site tokens.
 */

import { formatBytes, type HostedAttachment } from "@/helpers/enquiry-files";
import { EMAIL_BADGES } from "./badges";

const SITE = "Upper Street Contractors";
const BRAND = {
  dark: "#031021",
  gold: "#906d37",
  surface: "#e5decb",
  border: "#d6cdb6",
  muted: "#4a5a6b",
  subtle: "#7a8798",
  white: "#f8fdf9",
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

/**
 * Download links for the hosted attachments — the ones too large to ride the
 * email as real MIME attachments (ADR 0014). `isBlobUrl` has already vetted
 * every href server-side; `escapeHtml` here guards the attribute itself.
 */
function hostedLinksHtml(links: HostedAttachment[]): string {
  if (!links.length) return "";

  const items = links
    .map(
      (l) => `
      <li style="margin:0 0 6px;">
        <a href="${escapeHtml(l.url)}" style="color:${BRAND.gold};font-weight:600;text-decoration:underline;">${escapeHtml(l.name)}</a>
        <span style="color:${BRAND.subtle};"> — ${escapeHtml(formatBytes(l.size))}</span>
      </li>`,
    )
    .join("");

  return `
    <tr>
      <td style="padding:0 30px 22px;">
        <div style="font-size:12px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:${BRAND.muted};margin-bottom:8px;">Large files</div>
        <ul style="margin:0;padding-left:18px;font-size:14px;line-height:1.6;color:${BRAND.dark};">${items}</ul>
      </td>
    </tr>`;
}

/** One <div> per paragraph — the confirmation opens with two. */
function introHtml(paragraphs: string[]): string {
  return paragraphs
    .map(
      (text, i) =>
        `<div${i > 0 ? ` style="margin-top:10px;"` : ""}>${escapeHtml(text)}</div>`,
    )
    .join("");
}

/**
 * The Email trust row. Only the marks whose files actually loaded are passed
 * in, so a missing PNG drops one badge rather than showing a broken image —
 * the same guarantee the header logo has.
 *
 * Nested presentation tables rather than flex or inline-block: this has to
 * survive Outlook, and a table row is the only thing that reliably keeps all
 * five marks on one line. That line is about 465px wide, so a phone's mail app
 * scales the message down slightly rather than reflowing it.
 */
function badgesHtml(cids: string[]): string {
  const badges = EMAIL_BADGES.filter((badge) => cids.includes(badge.cid));
  if (!badges.length) return "";

  const cells = badges
    .map((badge) => {
      const img = `<img src="cid:${badge.cid}" alt="${escapeHtml(badge.alt)}" width="${badge.width}" height="${badge.height}" style="display:block;border:0;" />`;
      const content = badge.href
        ? `<a href="${escapeHtml(badge.href)}" style="text-decoration:none;">${img}</a>`
        : img;
      return `<td align="center" valign="middle" style="padding:0 6px;">${content}</td>`;
    })
    .join("");

  return `
    <tr>
      <td align="center" style="padding:4px 16px 24px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid ${BRAND.border};">
          <tr>
            <td align="center" style="padding:16px 0 0;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>${cells}</tr></table>
            </td>
          </tr>
        </table>
      </td>
    </tr>`;
}

function layout(opts: {
  /** One paragraph per entry, in order. */
  intro: string[];
  fields: EnquiryField[];
  note?: string;
  hostedLinks?: HostedAttachment[];
  /** When set, the header shows the logo image (cid attachment) instead of text. */
  logoCid?: string;
  /** Trust-row marks whose files loaded; the rest are dropped. */
  badgeCids?: string[];
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
                ${
                  opts.logoCid
                    ? `<img src="cid:${opts.logoCid}" alt="${SITE}" width="220" style="display:block;border:0;height:auto;max-width:100%;" />`
                    : `<div style="font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:${BRAND.gold};font-weight:700;">${SITE}</div>`
                }
              </td>
            </tr>
            <tr>
              <td style="padding:24px 30px 6px;font-size:15px;line-height:1.6;color:${BRAND.muted};">${introHtml(opts.intro)}</td>
            </tr>
            <tr>
              <td style="padding:10px 16px 20px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${BRAND.border};border-radius:12px;overflow:hidden;">
                  ${rowsHtml(opts.fields)}
                </table>
              </td>
            </tr>
            ${hostedLinksHtml(opts.hostedLinks ?? [])}
            ${opts.note ? `<tr><td style="padding:0 30px 24px;font-size:13px;color:${BRAND.subtle};">${escapeHtml(opts.note)}</td></tr>` : ""}
            ${badgesHtml(opts.badgeCids ?? [])}
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
  hostedLinks?: HostedAttachment[];
  logoCid?: string;
  badgeCids?: string[];
}): { subject: string; html: string } {
  const who = opts.senderName || opts.senderEmail || "a website visitor";
  const note = opts.attachmentNames.length
    ? `Attachments: ${opts.attachmentNames.join(", ")}`
    : undefined;
  return {
    subject: `Online Enquiry${opts.senderName ? ` — ${opts.senderName}` : ""}`,
    html: layout({
      intro: [`You've received a new enquiry from ${who}. The details are below.`],
      fields: opts.fields,
      note,
      hostedLinks: opts.hostedLinks,
      logoCid: opts.logoCid,
      badgeCids: opts.badgeCids,
    }),
  };
}

export function renderConfirmationEmail(opts: {
  fields: EnquiryField[];
  senderName: string;
  attachmentNames: string[];
  hostedLinks?: HostedAttachment[];
  logoCid?: string;
  badgeCids?: string[];
}): { subject: string; html: string } {
  const note = opts.attachmentNames.length
    ? `You attached: ${opts.attachmentNames.join(", ")}`
    : undefined;
  return {
    subject: `Confirmation of Your Enquiry - ${SITE}`,
    html: layout({
      intro: [
        `Hi${opts.senderName ? ` ${opts.senderName}` : ""}, we received your enquiry. A member of our team will review the details and get back to you as soon as possible.`,
        "Below is a copy of what you sent.",
      ],
      fields: opts.fields,
      note,
      hostedLinks: opts.hostedLinks,
      logoCid: opts.logoCid,
      badgeCids: opts.badgeCids,
    }),
  };
}
