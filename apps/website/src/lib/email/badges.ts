/**
 * The Email trust row — the accreditation and review marks at the foot of both
 * enquiry emails, between the details and the copyright line.
 *
 * One source of truth for the render side (`templates.ts`) and the attach side
 * (`api/enquiry/route.ts`), so a `cid` cannot drift between them. Order here is
 * the order they appear: what we are certified as, then where to read about us.
 *
 * The images are frozen copies, generated and committed by
 * `scripts/generate-email-badges.mjs` — an enquiry send must not depend on the
 * CMS or the Blob store being reachable. Swapping a badge in the CMS therefore
 * does not reach these until someone re-runs that script.
 *
 * `width`/`height` are the script's reported output and must be stated
 * explicitly: Outlook does not compute an image's intrinsic size. They also add
 * up to roughly 465px, which is what keeps all five on one line inside a 600px
 * email — change a bound in the generator and these have to follow.
 */

export type EmailBadge = {
  /** Content-ID the MIME attachment is referenced by (`cid:` in the HTML). */
  cid: string;
  /** Filename under `apps/website/public`. */
  file: string;
  alt: string;
  /** Rendered size in CSS px. */
  width: number;
  height: number;
  /** Omitted where no public URL exists — the mark then renders unlinked. */
  href?: string;
};

export const EMAIL_BADGES: EmailBadge[] = [
  {
    cid: "badge-fmb",
    file: "email-badge-fmb.png",
    alt: "FMB Member — Federation of Master Builders",
    width: 112,
    height: 25,
    href: "https://www.fmb.org.uk/builder/upper-street-contractors-ltd.html",
  },
  {
    cid: "badge-gas-safe",
    file: "email-badge-gas-safe.png",
    alt: "Gas Safe Register",
    width: 35,
    height: 38,
  },
  {
    cid: "badge-niceic",
    file: "email-badge-niceic.png",
    alt: "NIC EIC Approved Contractor",
    width: 66,
    height: 38,
  },
  {
    cid: "badge-trustpilot",
    file: "email-badge-trustpilot.png",
    alt: "Read our reviews on Trustpilot",
    width: 110,
    height: 27,
    href: "https://uk.trustpilot.com/review/upperstreet.contractors",
  },
  {
    cid: "badge-google",
    file: "email-badge-google.png",
    alt: "Review us on Google",
    width: 83,
    height: 27,
    href: "https://g.page/r/Ca-S_khoHE56EAE/review",
  },
];
