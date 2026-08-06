/**
 * The Attachment contract, shared by the wizard (client) and the enquiry routes
 * (server). Every cap lives here exactly once — they used to be duplicated
 * across wizard.tsx, /api/enquiry and a hardcoded "10 MB" string in the helper
 * text, which drifted.
 *
 * Any file type is accepted. There is no allow-list: a renovation enquiry can
 * legitimately carry photos, videos, plans, spreadsheets or a surveyor's report,
 * and a MIME allow-list only ever rejected things visitors actually wanted to
 * send. The `accept` attribute was never a security control anyway — drag-drop
 * and direct POSTs bypass it — so the real protections are the size/count caps
 * below plus the rate limit on the upload-token route.
 *
 * Delivery is split two ways because no single path works (ADR 0014):
 *   - Vercel Functions cap a request body at ~4.5 MB, so the email route can
 *     only ever carry a few MB of real MIME attachments.
 *   - Gmail caps a message at 25 MB, and base64 inflates bytes ~37%, so even
 *     without Vercel an emailed video is impossible.
 * So each Attachment becomes either an *inline attachment* (rides the email) or
 * a *hosted attachment* (browser uploads it straight to Vercel Blob and the
 * email carries a download link).
 */

/** Mirrors the wizard file input's `accept` attribute — everything. */
export const ENQUIRY_FILE_ACCEPT = "*/*";

export const ENQUIRY_MAX_FILES = 10;
export const ENQUIRY_MAX_FILE_BYTES = 50 * 1024 * 1024; // 50 MB
export const ENQUIRY_MAX_TOTAL_BYTES = 200 * 1024 * 1024; // 200 MB

/**
 * How many bytes of real MIME attachments /api/enquiry will accept. Held well
 * under Vercel's ~4.5 MB request-body ceiling to leave room for the JSON
 * payload and multipart framing; anything past it becomes a hosted attachment.
 */
export const ENQUIRY_INLINE_BUDGET_BYTES = Math.round(3.5 * 1024 * 1024);

/** Hostname suffix every hosted attachment URL must carry — see below. */
export const BLOB_HOSTNAME_SUFFIX = ".public.blob.vercel-storage.com";

/** A file the visitor picked, as much of it as the server ever needs to know. */
export type EnquiryFileLike = { name: string; size: number };

/** A hosted attachment as it travels in the enquiry payload. */
export type HostedAttachment = {
  name: string;
  size: number;
  url: string;
};

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 KB";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;

  const mb = bytes / (1024 * 1024);

  return `${mb < 10 ? mb.toFixed(1) : Math.round(mb)} MB`;
}

/** The caps, as the sentence printed under the file input. */
export function enquiryFileCapsText(): string {
  return `Up to ${ENQUIRY_MAX_FILES} files, ${formatBytes(ENQUIRY_MAX_FILE_BYTES)} per file, ${formatBytes(ENQUIRY_MAX_TOTAL_BYTES)} in total. Any file type.`;
}

/**
 * Validates a whole Attachment set against all three caps, returning the
 * visitor-facing reason it failed or `null` when it is fine. Called on the
 * merged set (existing + newly picked) client-side, and again server-side — the
 * caps are the only thing standing between a public form and an unbounded
 * upload.
 *
 * A message-or-null rather than a discriminated union: this workspace compiles
 * with `strict: false`, where narrowing a `{ ok: true } | { ok: false }` union
 * does not hold.
 */
export function validateEnquiryFiles(
  files: readonly EnquiryFileLike[],
): string | null {
  if (files.length > ENQUIRY_MAX_FILES) {
    return `Please attach at most ${ENQUIRY_MAX_FILES} files.`;
  }

  const tooBig = files.filter((f) => f.size > ENQUIRY_MAX_FILE_BYTES);
  if (tooBig.length) {
    return `Each file must be under ${formatBytes(ENQUIRY_MAX_FILE_BYTES)}. Too large: ${tooBig
      .map((f) => f.name)
      .join(", ")}.`;
  }

  const total = files.reduce((sum, f) => sum + f.size, 0);
  if (total > ENQUIRY_MAX_TOTAL_BYTES) {
    return `Attachments must total under ${formatBytes(ENQUIRY_MAX_TOTAL_BYTES)} (currently ${formatBytes(total)}).`;
  }

  return null;
}

/**
 * Splits an Attachment set into what rides the email and what goes to Blob.
 *
 * Greedy in the visitor's own order: fill the inline budget first, then send
 * everything that did not fit to Blob. Walking in order (rather than, say,
 * smallest-first) keeps the split predictable — the file list in the wizard
 * shows each row's destination, and reordering it under the visitor would make
 * that label look arbitrary.
 */
export function planEnquiryDelivery<T extends EnquiryFileLike>(
  files: readonly T[],
): { inline: T[]; hosted: T[] } {
  const inline: T[] = [];
  const hosted: T[] = [];
  let used = 0;

  for (const file of files) {
    if (used + file.size <= ENQUIRY_INLINE_BUDGET_BYTES) {
      inline.push(file);
      used += file.size;
    } else {
      hosted.push(file);
    }
  }

  return { inline, hosted };
}

/**
 * True only for a real Vercel Blob URL on this account's public host.
 *
 * `hostedLinks` arrives from the browser, so without this check /api/enquiry
 * would happily drop any attacker-chosen URL into a mail the business trusts —
 * a phishing relay wearing our own branding.
 */
export function isBlobUrl(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }

  return (
    parsed.protocol === "https:" &&
    parsed.hostname.endsWith(BLOB_HOSTNAME_SUFFIX)
  );
}

/** Keeps only well-formed hosted attachments pointing at our own Blob store. */
export function sanitizeHostedAttachments(input: unknown): HostedAttachment[] {
  if (!Array.isArray(input)) return [];

  return input
    .filter((h): h is HostedAttachment => {
      if (!h || typeof h !== "object") return false;
      const { name, size, url } = h as Record<string, unknown>;

      return (
        typeof name === "string" &&
        typeof url === "string" &&
        typeof size === "number" &&
        Number.isFinite(size) &&
        isBlobUrl(url)
      );
    })
    .slice(0, ENQUIRY_MAX_FILES);
}
