/**
 * Enquiry attachment allow-list, shared by the wizard (client) and
 * /api/enquiry (server) so the "images / PDF / Word" contract is enforced on
 * both sides — the file input's `accept` attribute is only a picker hint and
 * is trivially bypassed (drag-drop, programmatic set, direct POST).
 */

/** Mirrors the wizard file input's `accept` attribute. */
export const ENQUIRY_FILE_ACCEPT = "image/*,.pdf,.doc,.docx";

const ALLOWED_MIME = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

// Extension fallback for browsers/clients that send an empty `type`.
const ALLOWED_EXT = /\.(png|jpe?g|gif|webp|heic|heif|avif|bmp|tiff?|pdf|docx?)$/i;

export function isAllowedEnquiryFile(file: {
  name: string;
  type: string;
}): boolean {
  if (file.type.startsWith("image/")) return true;
  if (ALLOWED_MIME.has(file.type)) return true;
  return !file.type && ALLOWED_EXT.test(file.name);
}

export const ENQUIRY_FILE_TYPE_ERROR =
  "Only images, PDF or Word documents can be attached.";
