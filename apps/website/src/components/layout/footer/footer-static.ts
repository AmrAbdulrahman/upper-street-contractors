/*
 * `FOOTER_ACCREDITATIONS` used to live here — three hardcoded text labels
 * ("FMB Member", "TrustMark", "Fully Insured"). They were never the same three
 * the home page showed as real logos, which is what a second hardcoded copy of
 * CMS content always ends up doing. The footer row now reads
 * `siteMetaConfig.footerAccreditations`, editable on Site settings' Footer tab.
 */

/**
 * Published opening hours. Sunday is absent because the business is closed.
 *
 * The Enquiry Wizard's calendar has to agree with this — it mirrors the closed
 * days in `CLOSED_WEEKDAYS` (`components/sections/wizard/helpers.ts`). Change
 * one and change the other, until both move into Settings.
 */
export const FOOTER_OPENING_HOURS = [
  "Mon–Fri: 8am–6pm",
  "Sat: 9am–2pm",
] as const;

export const FOOTER_COMPANY_REGISTRATION =
  "Company No. 10225181 · Registered in England & Wales";
